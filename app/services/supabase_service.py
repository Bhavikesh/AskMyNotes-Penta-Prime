"""
SupabaseService — single point of contact for all Supabase DB operations.

All methods accept and filter by user_id so cross-user data leakage is
impossible at the storage layer.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional
from uuid import UUID

from supabase import create_client, Client

from app.config import get_settings

logger = logging.getLogger(__name__)


class SupabaseService:
    """Singleton wrapper around the Supabase Python client."""

    _instance: Optional["SupabaseService"] = None

    def __new__(cls) -> "SupabaseService":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._connect()
        return cls._instance

    def _connect(self):
        """Create (or recreate) the Supabase client."""
        settings = get_settings()
        self.client: Client = create_client(
            settings.SUPABASE_URL, settings.SUPABASE_KEY
        )
        logger.info("Supabase client initialised")

    def reconnect(self):
        """Force reconnect — call this if a request fails with a connection error."""
        logger.warning("Reconnecting Supabase client...")
        self._connect()

    # ── Users ────────────────────────────────────────────────────────────────

    def upsert_user(self, user_id: str, email: Optional[str] = None) -> Dict:
        """Create or update a user row."""
        payload: Dict[str, Any] = {"id": user_id}
        if email:
            payload["email"] = email
        result = (
            self.client.table("users")
            .upsert(payload, on_conflict="id")
            .execute()
        )
        return result.data[0] if result.data else {}

    def get_user(self, user_id: str) -> Optional[Dict]:
        result = self.client.table("users").select("*").eq("id", user_id).execute()
        return result.data[0] if result.data else None

    # ── Subjects ─────────────────────────────────────────────────────────────

    def get_subjects(self, user_id: str) -> List[Dict]:
        result = (
            self.client.table("subjects")
            .select("*")
            .eq("user_id", user_id)
            .order("created_at")
            .execute()
        )
        return result.data or []

    def count_subjects(self, user_id: str) -> int:
        result = (
            self.client.table("subjects")
            .select("id", count="exact")
            .eq("user_id", user_id)
            .execute()
        )
        return result.count or 0

    def create_subject(self, user_id: str, name: str) -> Dict:
        result = (
            self.client.table("subjects")
            .insert({"user_id": user_id, "name": name})
            .execute()
        )
        return result.data[0] if result.data else {}

    def get_subject_by_id(self, user_id: str, subject_id: str) -> Optional[Dict]:
        result = (
            self.client.table("subjects")
            .select("*")
            .eq("id", subject_id)
            .eq("user_id", user_id)
            .execute()
        )
        return result.data[0] if result.data else None

    def delete_subject(self, user_id: str, subject_id: str) -> bool:
        self.client.table("subjects").delete().eq("id", subject_id).eq(
            "user_id", user_id
        ).execute()
        return True

    # ── Documents ─────────────────────────────────────────────────────────────

    def register_document(
        self, user_id: str, subject_id: str, file_name: str
    ) -> Dict:
        result = (
            self.client.table("documents")
            .insert(
                {"user_id": user_id, "subject_id": subject_id, "file_name": file_name}
            )
            .execute()
        )
        return result.data[0] if result.data else {}

    def get_documents_by_subject(self, user_id: str, subject_id: str) -> List[Dict]:
        result = (
            self.client.table("documents")
            .select("*")
            .eq("user_id", user_id)
            .eq("subject_id", subject_id)
            .execute()
        )
        return result.data or []

    def count_documents_by_subject(self, user_id: str, subject_id: str) -> int:
        result = (
            self.client.table("documents")
            .select("id", count="exact")
            .eq("user_id", user_id)
            .eq("subject_id", subject_id)
            .execute()
        )
        return result.count or 0

    # ── Chunks ────────────────────────────────────────────────────────────────

    def insert_chunk(
        self,
        user_id: str,
        subject_id: str,
        document_id: str,
        chunk_id: int,
        page_number: Optional[int],
        text: str,
        embedding_id: int,
        file_name: str = "",
    ) -> Dict:
        result = (
            self.client.table("chunks_metadata")
            .insert(
                {
                    "user_id": user_id,
                    "subject_id": subject_id,
                    "document_id": document_id,
                    "chunk_id": chunk_id,
                    "page_number": page_number,
                    "file_name": file_name,
                    "text": text,
                    "embedding_id": embedding_id,
                }
            )
            .execute()
        )
        return result.data[0] if result.data else {}

    def get_chunks_by_subject(
        self, user_id: str, subject_id: str
    ) -> List[Dict]:
        """Fetch all chunk rows for a user+subject (used for study mode)."""
        result = (
            self.client.table("chunks_metadata")
            .select("*")
            .eq("user_id", user_id)
            .eq("subject_id", subject_id)
            .execute()
        )
        return result.data or []

    # ── Queries ───────────────────────────────────────────────────────────────

    def log_query(
        self,
        user_id: str,
        subject_id: str,
        question: str,
        answer: str,
        confidence: str,
    ) -> Dict:
        result = (
            self.client.table("queries")
            .insert(
                {
                    "user_id": user_id,
                    "subject_id": subject_id,
                    "question": question,
                    "answer": answer,
                    "confidence": confidence,
                }
            )
            .execute()
        )
        return result.data[0] if result.data else {}

    # ── Study Sessions ─────────────────────────────────────────────────────────

    def log_study_session(
        self, user_id: str, subject_id: str, score: int, total_questions: int
    ) -> Dict:
        result = (
            self.client.table("study_sessions")
            .insert(
                {
                    "user_id": user_id,
                    "subject_id": subject_id,
                    "score": score,
                    "total_questions": total_questions,
                }
            )
            .execute()
        )
        return result.data[0] if result.data else {}

    # ── Performance Metrics ────────────────────────────────────────────────────

    def log_performance_metric(
        self,
        user_id: str,
        subject_id: str,
        question_id: Optional[str],
        correct: Optional[bool],
        response_time: Optional[float],
    ) -> Dict:
        result = (
            self.client.table("performance_metrics")
            .insert(
                {
                    "user_id": user_id,
                    "subject_id": subject_id,
                    "question_id": question_id,
                    "correct": correct,
                    "response_time": response_time,
                }
            )
            .execute()
        )
        return result.data[0] if result.data else {}

    # ── Analytics ─────────────────────────────────────────────────────────────

    def get_analytics(self, user_id: str) -> Dict:
        """
        Returns raw data for analytics endpoint.
        Aggregates per subject from queries + performance_metrics + study_sessions.
        """
        # All subjects for user
        subjects = self.get_subjects(user_id)

        subject_stats = []
        for subj in subjects:
            sid = subj["id"]
            sname = subj["name"]

            # Query count and confidence aggregation
            q_result = (
                self.client.table("queries")
                .select("confidence")
                .eq("user_id", user_id)
                .eq("subject_id", sid)
                .execute()
            )
            queries = q_result.data or []
            questions_attempted = len(queries)

            # Map confidence labels to scores
            conf_map = {"High": 1.0, "Medium": 0.6, "Low": 0.3, "Not Found": 0.0}
            conf_scores = [conf_map.get(q.get("confidence", "Low"), 0.3) for q in queries]
            avg_confidence = (sum(conf_scores) / len(conf_scores)) if conf_scores else 0.0

            # Study session accuracy
            sess_result = (
                self.client.table("study_sessions")
                .select("score, total_questions")
                .eq("user_id", user_id)
                .eq("subject_id", sid)
                .execute()
            )
            sessions = sess_result.data or []
            total_correct = sum(s.get("score", 0) for s in sessions)
            total_q = sum(s.get("total_questions", 0) for s in sessions)
            accuracy = (total_correct / total_q * 100) if total_q > 0 else 0.0

            subject_stats.append(
                {
                    "subject": sname,
                    "accuracy": round(accuracy, 2),
                    "questions_attempted": questions_attempted,
                    "average_confidence": round(avg_confidence, 3),
                }
            )

        # Timeline: daily query count from queries table (last 30 days)
        timeline_result = (
            self.client.table("queries")
            .select("created_at, confidence")
            .eq("user_id", user_id)
            .order("created_at")
            .execute()
        )
        timeline_raw = timeline_result.data or []

        # Group by date
        from collections import defaultdict
        daily: Dict[str, List[float]] = defaultdict(list)
        conf_map = {"High": 1.0, "Medium": 0.6, "Low": 0.3, "Not Found": 0.0}
        for row in timeline_raw:
            day = row["created_at"][:10]  # YYYY-MM-DD
            daily[day].append(conf_map.get(row.get("confidence", "Low"), 0.3))

        timeline = [
            {
                "date": day,
                "accuracy": round(sum(scores) / len(scores) * 100, 2),
            }
            for day, scores in sorted(daily.items())
        ]

        return {"subjects": subject_stats, "timeline": timeline}
