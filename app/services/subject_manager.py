"""
SubjectManager — subject CRUD with max-3-per-user enforcement,
all persisted to Supabase.
"""
from __future__ import annotations

import logging
from typing import List
from uuid import UUID

from fastapi import HTTPException

from app.services.supabase_service import SupabaseService
from app.models.subject_models import SubjectResponse, SubjectListResponse

logger = logging.getLogger(__name__)

MAX_SUBJECTS_PER_USER = 3


class SubjectManager:
    """Manages subject lifecycle for a specific user via Supabase."""

    def __init__(self):
        self.db = SupabaseService()

    async def create_subject(self, user_id: str, name: str) -> SubjectResponse:
        """Create a subject. Raises 400 if user already has 3 subjects."""
        # Ensure user row exists (upsert is idempotent)
        self.db.upsert_user(user_id)

        count = self.db.count_subjects(user_id)
        if count >= MAX_SUBJECTS_PER_USER:
            raise HTTPException(
                status_code=400,
                detail=f"Maximum of {MAX_SUBJECTS_PER_USER} subjects allowed per user. "
                       f"Delete an existing subject to add a new one.",
            )

        # Check for duplicate name
        existing = self.db.get_subjects(user_id)
        if any(s["name"].lower() == name.lower() for s in existing):
            raise HTTPException(
                status_code=409,
                detail=f"Subject '{name}' already exists.",
            )

        row = self.db.create_subject(user_id, name)
        doc_count = self.db.count_documents_by_subject(user_id, row["id"])

        return SubjectResponse(
            id=row["id"],
            user_id=row["user_id"],
            name=row["name"],
            document_count=doc_count,
            created_at=row.get("created_at"),
        )

    async def list_subjects(self, user_id: str) -> SubjectListResponse:
        """List all subjects for a user with document counts."""
        self.db.upsert_user(user_id)
        rows = self.db.get_subjects(user_id)

        subjects = []
        for row in rows:
            doc_count = self.db.count_documents_by_subject(user_id, row["id"])
            subjects.append(
                SubjectResponse(
                    id=row["id"],
                    user_id=row["user_id"],
                    name=row["name"],
                    document_count=doc_count,
                    created_at=row.get("created_at"),
                )
            )
        return SubjectListResponse(subjects=subjects, total=len(subjects))

    async def get_subject(self, user_id: str, subject_id: str) -> dict:
        """Fetch a subject and validate ownership. Raises 404 if not found."""
        row = self.db.get_subject_by_id(user_id, subject_id)
        if not row:
            raise HTTPException(
                status_code=404,
                detail=f"Subject '{subject_id}' not found for this user.",
            )
        return row

    async def delete_subject(self, user_id: str, subject_id: str) -> bool:
        """Delete a subject (cascade removes documents + chunks in Supabase)."""
        await self.get_subject(user_id, subject_id)  # validate ownership
        self.db.delete_subject(user_id, subject_id)
        logger.info(f"Deleted subject {subject_id} for user {user_id}")
        return True
