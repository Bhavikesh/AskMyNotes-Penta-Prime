"""
conversation_service.py — Manages voice teacher conversation sessions and messages in Supabase.

Tables used:
  conversation_sessions  — one session per voice page visit
  conversation_messages  — each user/assistant turn
  voice_performance_metrics — student response evaluations
"""
from __future__ import annotations

import logging
from typing import List, Dict, Optional

from app.services.supabase_service import SupabaseService

logger = logging.getLogger(__name__)


class ConversationService:
    """Handles conversation memory for the voice teacher."""

    def __init__(self):
        self.db = SupabaseService()

    # ── Sessions ──────────────────────────────────────────────────────────────

    def create_session(self, user_id: str, subject_id: str) -> str:
        """Create a new conversation session, return session_id."""
        try:
            result = (
                self.db.client.table("conversation_sessions")
                .insert({"user_id": user_id, "subject_id": subject_id})
                .execute()
            )
            return result.data[0]["id"]
        except Exception as e:
            logger.error(f"Failed to create session: {e}")
            return ""

    def get_or_create_session(self, user_id: str, subject_id: str,
                               session_id: Optional[str] = None) -> str:
        """Return existing session_id or create a new one."""
        if session_id:
            return session_id
        return self.create_session(user_id, subject_id)

    # ── Messages ──────────────────────────────────────────────────────────────

    def add_message(self, session_id: str, role: str, message: str) -> None:
        """Store a conversation message (role = 'user' | 'assistant')."""
        try:
            self.db.client.table("conversation_messages").insert({
                "session_id": session_id,
                "role": role,
                "message": message,
            }).execute()
        except Exception as e:
            logger.error(f"Failed to add message: {e}")

    def get_last_messages(self, session_id: str, limit: int = 10) -> List[Dict]:
        """Return last N messages as list of {role, content} dicts."""
        if not session_id:
            logger.warning("get_last_messages called with empty session_id")
            return []

    # ── Performance Metrics ──────────────────────────────────────────────────

    def store_evaluation(
        self,
        session_id: str,
        question: str,
        student_answer: str,
        evaluation: str,
        correct: Optional[bool],
    ) -> None:
        """Store a student answer evaluation in Supabase."""
        try:
            self.db.client.table("voice_performance_metrics").insert({
                "session_id": session_id,
                "question": question,
                "student_answer": student_answer,
                "evaluation": evaluation,
                "correct": correct,
            }).execute()
        except Exception as e:
            logger.error(f"Failed to store evaluation: {e}")
