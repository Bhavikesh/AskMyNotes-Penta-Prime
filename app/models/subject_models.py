from pydantic import BaseModel, Field
from typing import List, Optional
from uuid import UUID
from datetime import datetime


class SubjectCreate(BaseModel):
    user_id: UUID = Field(..., description="User UUID (from frontend)")
    name: str = Field(..., min_length=1, max_length=50, description="Subject name")

    class Config:
        json_schema_extra = {
            "example": {"user_id": "123e4567-e89b-12d3-a456-426614174000", "name": "Operating Systems"}
        }


class SubjectResponse(BaseModel):
    id: UUID
    user_id: UUID
    name: str
    document_count: int = 0
    created_at: Optional[datetime] = None

    class Config:
        json_schema_extra = {
            "example": {
                "id": "aabbccdd-1234-5678-abcd-ef0123456789",
                "user_id": "123e4567-e89b-12d3-a456-426614174000",
                "name": "Operating Systems",
                "document_count": 2,
                "created_at": "2025-07-01T10:00:00Z"
            }
        }


class SubjectListResponse(BaseModel):
    subjects: List[SubjectResponse]
    total: int
