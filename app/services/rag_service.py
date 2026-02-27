"""
RAGService — central pipeline for AskMyNotes.

Responsibilities:
  ingest_document  → parse → chunk → embed → FAISS → Supabase metadata
  query            → embed → search_by_subject → confidence → LLM → citations
"""
from __future__ import annotations

import logging
from typing import List, Optional, Tuple, Dict

from app.config import get_settings
from app.services.embedding_service import EmbeddingService
from app.services.vector_store import VectorStore
from app.services.text_chunker import TextChunker
from app.services.document_loader import DocumentLoader
from app.services.supabase_service import SupabaseService
from app.models.askmynotes_models import (
    AskMyNotesQueryResponse,
    Citation,
)

logger = logging.getLogger(__name__)
settings = get_settings()

# Module-level singletons shared across requests
_embedding_service: Optional[EmbeddingService] = None
_vector_store: Optional[VectorStore] = None


def _get_embedding_service() -> EmbeddingService:
    global _embedding_service
    if _embedding_service is None:
        _embedding_service = EmbeddingService(settings.EMBEDDING_MODEL)
    return _embedding_service


def _get_vector_store() -> VectorStore:
    global _vector_store
    if _vector_store is None:
        _vector_store = VectorStore(settings.EMBEDDING_DIMENSION)
    return _vector_store


class RAGService:
    """Handles AskMyNotes ingestion and querying."""

    def __init__(self):
        self.embedder = _get_embedding_service()
        self.vector_store = _get_vector_store()
        self.chunker = TextChunker(
            chunk_size=settings.CHUNK_SIZE,
            overlap=settings.CHUNK_OVERLAP,
        )
        self.db = SupabaseService()

    # ── Ingestion ─────────────────────────────────────────────────────────────

    async def ingest_document(
        self,
        user_id: str,
        subject_id: str,
        file_path: str,
        file_name: str,
    ) -> Dict:
        """
        Full pipeline:  file → text → chunks → embeddings → FAISS + Supabase
        Returns a dict with ingestion stats.
        """
        # 1. Extract text
        text = await DocumentLoader.load_and_extract(file_path)
        if not text:
            raise ValueError(f"Could not extract text from {file_name}")

        # 2. Detect page boundaries to pass page_number per chunk
        #    DocumentLoader inserts '--- Page N ---' markers
        import re
        chunks: List[Dict] = []
        current_page = 1
        segments = re.split(r"(--- Page \d+ ---)", text)
        full_text_for_chunking = ""
        for seg in segments:
            page_match = re.match(r"--- Page (\d+) ---", seg)
            if page_match:
                current_page = int(page_match.group(1))
            else:
                # chunk this segment with its page
                seg_chunks = self.chunker.chunk_by_sentences(
                    seg,
                    subject=subject_id,
                    file_name=file_name,
                    page_number=current_page,
                )
                # Adjust chunk_ids to be globally unique for this file
                offset = len(chunks)
                for c in seg_chunks:
                    c["chunk_id"] = c["chunk_id"] + offset
                chunks.extend(seg_chunks)

        # Fallback: if no page markers, chunk the whole text
        if not chunks:
            chunks = self.chunker.chunk_by_sentences(
                text, subject=subject_id, file_name=file_name, page_number=1
            )

        if not chunks:
            raise ValueError("No chunks produced from document")

        # 3. Generate embeddings
        texts = [c["text"] for c in chunks]
        embeddings = self.embedder.embed_texts(texts)

        # 4. Add to FAISS — returns starting index position
        start_idx = self.vector_store.add_chunks(embeddings, chunks)

        # 5. Register document in Supabase
        doc_row = self.db.register_document(user_id, subject_id, file_name)
        doc_id = doc_row["id"]

        # 6. Store chunk metadata in Supabase with embedding_id
        for i, chunk in enumerate(chunks):
            self.db.insert_chunk(
                user_id=user_id,
                subject_id=subject_id,
                document_id=doc_id,
                chunk_id=chunk["chunk_id"],
                page_number=chunk.get("page_number"),
                text=chunk["text"],
                embedding_id=start_idx + i,
                file_name=file_name,
            )

        logger.info(
            f"Ingested '{file_name}' → {len(chunks)} chunks, "
            f"FAISS positions {start_idx}–{start_idx + len(chunks) - 1}"
        )
        return {
            "document_id": doc_id,
            "file_name": file_name,
            "chunks_created": len(chunks),
            "subject_id": subject_id,
        }

    # ── Query ─────────────────────────────────────────────────────────────────

    async def query(
        self,
        user_id: str,
        subject_id: str,
        subject_name: str,
        question: str,
        conversation_history: list = None,
        voice_mode: bool = False,
    ) -> AskMyNotesQueryResponse:
        """
        End-to-end query:
          embed → search_by_subject → refusal OR LLM answer + citations
        Supports multi-turn conversation via conversation_history.
        Voice mode uses a faster model and fewer tokens for instant responses.
        """
        # Voice mode: use fewer chunks for speed
        top_k = 3 if voice_mode else settings.TOP_K_CHUNKS

        # 1. Embed question
        q_emb = self.embedder.embed_query(question)

        # 2. Fetch chunk metadata from Supabase (user+subject scoped)
        supabase_chunks = self.db.get_chunks_by_subject(user_id, subject_id)

        # 3. Subject-filtered FAISS search
        results: List[Tuple[Dict, float]] = self.vector_store.search_by_subject(
            query_embedding=q_emb,
            user_id=user_id,
            subject_id=subject_id,
            top_k=top_k,
            score_threshold=settings.SIMILARITY_THRESHOLD,
            supabase_chunks=supabase_chunks,
        )

        # 4. Refusal logic — no relevant chunks
        if not results:
            refusal = f"Not found in your notes for {subject_name}"
            self.db.log_query(user_id, subject_id, question, refusal, "Not Found")
            return AskMyNotesQueryResponse(
                answer=refusal,
                confidence="Not Found",
                citations=[],
                evidence=[],
            )

        # 5. Confidence scoring (based on top chunk score)
        top_score = results[0][1]
        confidence = self._score_to_confidence(top_score)

        # 6. Build context for LLM
        context_parts = []
        for i, (chunk, score) in enumerate(results, 1):
            context_parts.append(
                f"[Source {i} | File: {chunk.get('file_name','?')} | "
                f"Page: {chunk.get('page_number','?')} | Score: {score:.2f}]\n"
                f"{chunk['text']}"
            )
        context = "\n\n".join(context_parts)

        # 7. LLM answer with multi-turn conversation support
        from groq import AsyncGroq
        groq = AsyncGroq(api_key=settings.GROQ_API_KEY)

        # Voice mode: faster model, shorter responses
        if voice_mode:
            model = "llama-3.1-8b-instant"
            max_tokens = 500
        else:
            model = settings.GROQ_MODEL
            max_tokens = settings.LLM_MAX_TOKENS

        messages = [
            {"role": "system", "content": (
                "You are an enthusiastic, interactive teacher having a real spoken conversation "
                "with a student. Your personality:\n\n"
                "1. ANSWER their question clearly and concisely from the provided notes.\n"
                "2. After answering, ALWAYS engage the student by doing ONE of these:\n"
                "   - Ask a follow-up question to check their understanding (e.g., 'Can you tell me what happens when...?')\n"
                "   - Offer to explain deeper (e.g., 'Would you like me to give you a real-world example?')\n"
                "   - Connect to related topics (e.g., 'This relates to X — shall I explain that too?')\n"
                "   - Quiz them (e.g., 'Quick quiz: What are the three conditions for...?')\n"
                "3. Keep your tone warm, encouraging, and conversational — like talking to a student face to face.\n"
                "4. Use simple language. Avoid jargon unless explaining it.\n"
                "5. If the student answers your question, evaluate their answer and guide them.\n"
                "6. NEVER make up information. Only use the provided notes.\n"
                "7. Keep responses SHORT (2-4 sentences for the answer + 1 follow-up question). "
                "This is a voice conversation, so be concise.\n"
                "8. If the student says 'yes', 'okay', 'sure', 'tell me more' — continue teaching from the notes."
            )},
        ]

        # Inject conversation history for multi-turn context
        if conversation_history:
            for turn in conversation_history[-10:]:  # Keep last 10 turns
                messages.append({"role": turn.get("role", "user"), "content": turn.get("content", "")})

        # System prompt instruction about output format
        if voice_mode:
            format_instruction = (
                "\n\nIMPORTANT: You MUST respond in this EXACT JSON format:\n"
                '{\n  "answer": "...your teaching explanation...",\n'
                '  "follow_up_question": "...the follow-up question you ask the student..."\n}\n'
                "Keep answer under 3 sentences. Make the follow_up_question engaging and based on the notes."
            )
        else:
            format_instruction = ""

        # Current question with notes context
        prompt = (
            f"NOTES:\n{context}\n\n"
            f"QUESTION: {question}\n\n"
            f"Provide a concise, accurate answer based strictly on the notes above."
            f"{format_instruction}"
        )
        messages.append({"role": "user", "content": prompt})

        response = await groq.chat.completions.create(
            model=model,
            messages=messages,
            temperature=settings.LLM_TEMPERATURE,
            max_tokens=max_tokens,
        )
        raw_answer = response.choices[0].message.content.strip()

        # 8b. In voice_mode, parse JSON to extract answer + follow_up_question
        follow_up_question = None
        if voice_mode:
            import json, re
            try:
                # Strip markdown code fences if present
                clean = re.sub(r"```(?:json)?\s*", "", raw_answer).strip().rstrip("`")
                parsed = json.loads(clean)
                answer = parsed.get("answer", raw_answer).strip()
                follow_up_question = parsed.get("follow_up_question", "").strip()
            except Exception:
                # If JSON parse fails, use raw answer as-is
                answer = raw_answer
                follow_up_question = ""
        else:
            answer = raw_answer

        # 8c. Build citations + evidence
        citations = [
            Citation(
                file=chunk.get("file_name", "unknown"),
                page=chunk.get("page_number"),
                chunk_id=chunk.get("chunk_id", 0),
            )
            for chunk, _ in results
        ]
        evidence = [chunk["text"] for chunk, _ in results]

        # 9. Log query to Supabase
        self.db.log_query(user_id, subject_id, question, answer, confidence)

        return AskMyNotesQueryResponse(
            answer=answer,
            confidence=confidence,
            citations=citations,
            evidence=evidence,
            follow_up_question=follow_up_question,
        )

    # ── Helpers ───────────────────────────────────────────────────────────────

    @staticmethod
    def _score_to_confidence(score: float) -> str:
        if score > 0.65:
            return "High"
        elif score > 0.4:
            return "Medium"
        else:
            return "Low"
