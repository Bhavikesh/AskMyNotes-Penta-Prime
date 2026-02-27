"""
AnalyticsService — wraps SupabaseService analytics aggregation
and formats it into the AnalyticsResponse model.
"""
from __future__ import annotations

import logging

from app.services.supabase_service import SupabaseService
from app.models.askmynotes_models import (
    AnalyticsResponse,
    SubjectAnalytics,
    TimelinePoint,
)

logger = logging.getLogger(__name__)


class AnalyticsService:
    def __init__(self):
        self.db = SupabaseService()

    async def get_performance(self, user_id: str) -> AnalyticsResponse:
        """Fetch and format analytics data for a user."""
        raw = self.db.get_analytics(user_id)

        subjects = [
            SubjectAnalytics(
                subject=s["subject"],
                accuracy=s["accuracy"],
                questions_attempted=s["questions_attempted"],
                average_confidence=s["average_confidence"],
                tests_taken=s.get("tests_taken", 0),
                best_score=s.get("best_score", 0),
                latest_score=s.get("latest_score", 0),
                total_correct=s.get("total_correct", 0),
                total_questions_tested=s.get("total_questions_tested", 0),
                study_minutes=s.get("study_minutes", 0),
            )
            for s in raw.get("subjects", [])
        ]

        timeline = [
            TimelinePoint(date=t["date"], accuracy=t["accuracy"])
            for t in raw.get("timeline", [])
        ]

        return AnalyticsResponse(
            subjects=subjects,
            timeline=timeline,
            total_study_minutes=raw.get("total_study_minutes", 0),
            total_questions_asked=raw.get("total_questions_asked", 0),
            total_tests_taken=raw.get("total_tests_taken", 0),
        )
