"""
text_to_speech.py — Convert teacher responses to natural speech audio.

Uses edge-tts (Microsoft Edge TTS, free, no API key needed, high quality)
as the primary backend. Falls back to a simple beep if unavailable.
"""
from __future__ import annotations

import asyncio
import io
import logging
import tempfile
import os

logger = logging.getLogger(__name__)

# Voice options — teacher-like voices
TEACHER_VOICE = "en-US-AriaNeural"   # Natural, warm female teacher voice
TEACHER_VOICE_MALE = "en-US-GuyNeural"  # Alternative male voice


async def generate_speech(text: str, voice: str = TEACHER_VOICE) -> bytes:
    """
    Convert text to speech using edge-tts.

    Args:
        text: Text to speak.
        voice: Edge TTS voice name.

    Returns:
        MP3 audio bytes ready to stream to the browser.
    """
    try:
        import edge_tts

        communicate = edge_tts.Communicate(text, voice)
        audio_buffer = io.BytesIO()

        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                audio_buffer.write(chunk["data"])

        audio_bytes = audio_buffer.getvalue()
        if not audio_bytes:
            raise RuntimeError("edge-tts returned empty audio")

        return audio_bytes

    except ImportError:
        logger.warning("edge-tts not installed, trying gTTS fallback")
        return await _gtts_fallback(text)
    except Exception as e:
        logger.error(f"TTS error: {e}")
        raise RuntimeError(f"Text-to-speech failed: {e}")


async def _gtts_fallback(text: str) -> bytes:
    """Fallback: gTTS (Google Text-to-Speech, requires internet)."""
    try:
        from gtts import gTTS
        import asyncio

        def _sync():
            buf = io.BytesIO()
            tts = gTTS(text=text, lang="en", slow=False)
            tts.write_to_fp(buf)
            buf.seek(0)
            return buf.read()

        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, _sync)
    except Exception as e:
        raise RuntimeError(f"gTTS fallback failed: {e}")
