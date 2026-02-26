"""
Router: /voice — Real-time voice teacher pipeline.

Flow:
  POST /voice/query  (multipart: audio_file + user_id + subject_id + session_id)
    1. Transcribe audio → text  (Groq Whisper)
    2. Load conversation history from Supabase
    3. Run RAG query (teacher prompt, voice_mode=True)
    4. Save user + assistant messages
    5. Convert answer+follow_up → audio  (edge-tts)
    6. Return audio stream + JSON metadata header

  POST /voice/query-text  (JSON: question text, no audio)
    Same as above but skips step 1 — used by browser Web Speech API path.
"""
from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Form, HTTPException, UploadFile, File
from fastapi.responses import Response, JSONResponse

from app.services.rag_service import RAGService
from app.services.speech_to_text import transcribe_audio
from app.services.text_to_speech import generate_speech
from app.services.conversation_service import ConversationService
from app.services.subject_manager import SubjectManager

logger = logging.getLogger(__name__)
router = APIRouter()

rag = RAGService()
conv = ConversationService()
subject_mgr = SubjectManager()


# ── helpers ────────────────────────────────────────────────────────────────

def _build_spoken_text(answer: str, follow_up: str) -> str:
    """Combine answer + follow-up into one fluent spoken string."""
    if follow_up and follow_up.strip():
        return f"{answer.strip()} ... {follow_up.strip()}"
    return answer.strip()


# ── endpoints ──────────────────────────────────────────────────────────────

@router.post("/query")
async def voice_query_audio(
    audio_file: UploadFile = File(...),
    user_id: str = Form(...),
    subject_id: str = Form(...),
    session_id: str = Form(default=""),
    mime_type: str = Form(default="audio/webm"),
):
    """
    Full voice pipeline: audio → text → RAG → TTS → audio bytes.
    """
    # 1. Transcribe audio
    try:
        audio_bytes = await audio_file.read()
        question = await transcribe_audio(audio_bytes, mime_type)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Transcription failed: {e}")

    if not question.strip():
        raise HTTPException(status_code=400, detail="Could not understand the audio. Please try again.")

    return await _process_voice_query(user_id, subject_id, session_id, question)


@router.post("/query-text")
async def voice_query_text(
    user_id: str = Form(...),
    subject_id: str = Form(...),
    question: str = Form(...),
    session_id: str = Form(default=""),
):
    """
    Text input → RAG → TTS → audio bytes.
    Used when browser Web Speech API handles STT on the frontend.
    """
    return await _process_voice_query(user_id, subject_id, session_id, question)


async def _process_voice_query(
    user_id: str,
    subject_id: str,
    session_id: str,
    question: str,
) -> Response:
    """
    Shared logic:
    1. Validate subject
    2. Get/create conversation session
    3. Load history
    4. Run RAG (voice_mode=True)
    5. Store messages
    6. Convert to speech
    7. Return audio with metadata headers
    """
    # 1. Validate subject
    try:
        subject = await subject_mgr.get_subject(user_id, subject_id)
        subject_name = subject["name"]
    except Exception:
        raise HTTPException(status_code=404, detail="Subject not found")

    # 2. Get or create session
    active_session = conv.get_or_create_session(user_id, subject_id, session_id or None)
    if not active_session:
        logger.error("Failed to obtain a valid conversation session ID.")
        raise HTTPException(status_code=500, detail="Unable to create conversation session.")

    # 3. Load conversation history
    history = conv.get_last_messages(active_session, limit=10)

    # 4. RAG query (teacher mode)
    try:
        result = await rag.query(
            user_id=user_id,
            subject_id=subject_id,
            subject_name=subject_name,
            question=question,
            conversation_history=history,
            voice_mode=True,
        )
    except Exception as e:
        logger.error(f"RAG error: {e}")
        raise HTTPException(status_code=500, detail=f"Query failed: {e}")

    answer = result.answer
    follow_up = result.follow_up_question if hasattr(result, "follow_up_question") else ""

    # 5. Store messages in Supabase
    if active_session:
        conv.add_message(active_session, "user", question)
        full_response = f"{answer}\n\n{follow_up}".strip() if follow_up else answer
        conv.add_message(active_session, "assistant", full_response)

    # 6. Convert to speech
    spoken_text = _build_spoken_text(answer, follow_up)
    try:
        audio = await generate_speech(spoken_text)
    except Exception as e:
        logger.warning(f"TTS failed, returning JSON only: {e}")
        return JSONResponse({
            "answer": answer,
            "follow_up_question": follow_up,
            "question": question,
            "session_id": active_session,
            "confidence": result.confidence,
            "citations": [c.dict() for c in (result.citations or [])],
            "tts_failed": True,
        })

    # 7. Return audio with metadata in response headers
    if not active_session:
        raise HTTPException(status_code=500, detail="Session ID missing after processing.")
    from fastapi.responses import StreamingResponse
    audio_stream = StreamingResponse(iter([audio]), media_type="audio/mpeg")
    audio_stream.headers.update({
        "X-Answer": answer[:500],
        "X-Follow-Up": (follow_up or "")[:300],
        "X-Question": question[:200],
        "X-Session-Id": active_session,
        "X-Confidence": result.confidence or "",
        "Access-Control-Expose-Headers": "X-Answer, X-Follow-Up, X-Question, X-Session-Id, X-Confidence",
    })
    return audio_stream



@router.post("/session/new")
async def create_session(user_id: str = Form(...), subject_id: str = Form(...)):
    """Create a new conversation session — call when user opens Voice page."""
    session_id = conv.create_session(user_id, subject_id)
    return {"session_id": session_id}


@router.get("/session/{session_id}/history")
async def get_session_history(session_id: str, limit: int = 20):
    """Retrieve conversation history for a session."""
    messages = conv.get_last_messages(session_id, limit=limit)
    return {"messages": messages}
