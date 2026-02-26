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
            )
            for s in raw.get("subjects", [])
        ]

        timeline = [
            TimelinePoint(date=t["date"], accuracy=t["accuracy"])
            for t in raw.get("timeline", [])
        ]

        return AnalyticsResponse(subjects=subjects, timeline=timeline)
