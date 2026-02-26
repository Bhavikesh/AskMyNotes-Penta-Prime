"""
StudyModeService — generates MCQs and Short Answer Questions from subject notes.
Uses retrieved chunks as grounding context for the LLM.
Logs study sessions to Supabase.
"""
from __future__ import annotations

import json
import logging
from typing import Dict, List

from groq import AsyncGroq

from app.config import get_settings
from app.services.supabase_service import SupabaseService
from app.services.embedding_service import EmbeddingService
from app.services.vector_store import VectorStore
from app.models.askmynotes_models import (
    Citation,
    MCQ,
    MCQOption,
    ShortAnswerQ,
    StudyModeResponse,
)

logger = logging.getLogger(__name__)
settings = get_settings()

# Reuse module-level singletons from rag_service
from app.services.rag_service import _get_embedding_service, _get_vector_store


class StudyModeService:
    def __init__(self):
        self.embedder = _get_embedding_service()
        self.vector_store = _get_vector_store()
        self.db = SupabaseService()
        self.groq = AsyncGroq(api_key=settings.GROQ_API_KEY)

    async def generate(
        self, user_id: str, subject_id: str, subject_name: str
    ) -> StudyModeResponse:
        """
        1. Retrieve all chunks for the subject.
        2. Use top chunks as LLM context.
        3. Prompt LLM for 5 MCQs + 3 SAQs in JSON.
        4. Parse + attach citations/evidence.
        5. Log study session.
        """
        # 1. Get chunks from Supabase
        supabase_chunks = self.db.get_chunks_by_subject(user_id, subject_id)
        if not supabase_chunks:
            return StudyModeResponse(subject=subject_name, mcqs=[], short_answers=[])

        # 2. Use top 20 chunks (most text variety) as context
        context_chunks = supabase_chunks[:20]
        context = "\n\n".join(
            f"[File: {c.get('file_name','?')} | Page: {c.get('page_number','?')}]\n{c['text']}"
            for c in context_chunks
        )

        # 3. LLM prompt — asks for structured JSON
        prompt = f"""You are a study-quiz generator. Based ONLY on the notes below, generate:
- 5 Multiple Choice Questions (MCQs)
- 3 Short Answer Questions

Subject: {subject_name}

NOTES:
{context[:12000]}

Output STRICT JSON in this exact format (no markdown, no extra text):
{{
  "mcqs": [
    {{
      "question": "...",
      "options": {{"A": "...", "B": "...", "C": "...", "D": "..."}},
      "correct_answer": "A",
      "evidence": "exact quote from notes that supports this"
    }}
  ],
  "short_answers": [
    {{
      "question": "...",
      "answer": "...",
      "evidence": "exact quote from notes"
    }}
  ]
}}"""

        try:
            response = await self.groq.chat.completions.create(
                model=settings.GROQ_MODEL,
                messages=[
                    {
                        "role": "system",
                        "content": "You are a study quiz generator. Output only valid JSON.",
                    },
                    {"role": "user", "content": prompt},
                ],
                temperature=0.4,
                max_tokens=3000,
            )
            raw = response.choices[0].message.content.strip()

            # Strip markdown code fences if present
            if raw.startswith("```"):
                raw = raw.split("```")[1]
                if raw.startswith("json"):
                    raw = raw[4:]
            raw = raw.strip().rstrip("```").strip()

            data = json.loads(raw)
        except (json.JSONDecodeError, Exception) as e:
            logger.error(f"StudyMode LLM parse error: {e}")
            data = {"mcqs": [], "short_answers": []}

        # 4. Build citation helpers (use first context chunk per question as citation)
        def make_citation(idx: int) -> List[Citation]:
            chunk = context_chunks[idx % len(context_chunks)]
            return [
                Citation(
                    file=chunk.get("file_name", "unknown"),
                    page=chunk.get("page_number"),
                    chunk_id=chunk.get("chunk_id", 0),
                )
            ]

        mcqs: List[MCQ] = []
        for i, item in enumerate(data.get("mcqs", [])[:5]):
            try:
                opts = item.get("options", {})
                mcqs.append(
                    MCQ(
                        question=item["question"],
                        options=MCQOption(
                            A=opts.get("A", ""),
                            B=opts.get("B", ""),
                            C=opts.get("C", ""),
                            D=opts.get("D", ""),
                        ),
                        correct_answer=item.get("correct_answer", "A"),
                        citations=make_citation(i),
                        evidence=[item.get("evidence", "")],
                    )
                )
            except Exception as e:
                logger.warning(f"Skipping malformed MCQ {i}: {e}")

        saqs: List[ShortAnswerQ] = []
        for i, item in enumerate(data.get("short_answers", [])[:3]):
            try:
                saqs.append(
                    ShortAnswerQ(
                        question=item["question"],
                        answer=item["answer"],
                        citations=make_citation(i),
                        evidence=[item.get("evidence", "")],
                    )
                )
            except Exception as e:
                logger.warning(f"Skipping malformed SAQ {i}: {e}")

        # 5. Log study session (score unknown at generation time; 0 until graded)
        total_q = len(mcqs) + len(saqs)
        self.db.log_study_session(user_id, subject_id, score=0, total_questions=total_q)

        return StudyModeResponse(
            subject=subject_name, mcqs=mcqs, short_answers=saqs
        )
