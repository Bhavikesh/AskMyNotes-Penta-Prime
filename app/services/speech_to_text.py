"""
speech_to_text.py — Browser Web Speech API handles STT on the frontend.
This service provides server-side Whisper-based transcription as a fallback
when audio bytes are uploaded to the /voice/query endpoint.
"""
from __future__ import annotations

import io
import logging
import tempfile
import os
from typing import Optional

logger = logging.getLogger(__name__)


async def transcribe_audio(audio_bytes: bytes, mime_type: str = "audio/webm") -> str:
    """
    Transcribe audio bytes → text using OpenAI Whisper via Groq.
    Falls back to a simple error message if transcription fails.

    Args:
        audio_bytes: Raw audio bytes from the browser (webm/mp4/wav).
        mime_type: MIME type of the audio.

    Returns:
        Transcribed text string.
    """
    try:
        from groq import AsyncGroq
        from app.config import get_settings
        settings = get_settings()

        groq = AsyncGroq(api_key=settings.GROQ_API_KEY)

        # Determine extension from mime type
        ext_map = {
            "audio/webm": "webm",
            "audio/mp4": "mp4",
            "audio/wav": "wav",
            "audio/ogg": "ogg",
            "audio/mpeg": "mp3",
        }
        ext = ext_map.get(mime_type, "webm")

        # Write to temp file (Groq needs file object)
        with tempfile.NamedTemporaryFile(suffix=f".{ext}", delete=False) as tmp:
            tmp.write(audio_bytes)
            tmp_path = tmp.name

        try:
            with open(tmp_path, "rb") as f:
                response = await groq.audio.transcriptions.create(
                    file=(f"audio.{ext}", f, mime_type),
                    model="whisper-large-v3-turbo",
                    response_format="text",
                )
            return response.strip() if isinstance(response, str) else response.text.strip()
        finally:
            os.unlink(tmp_path)

    except Exception as e:
        logger.error(f"Transcription error: {e}")
        raise RuntimeError(f"Transcription failed: {e}")
