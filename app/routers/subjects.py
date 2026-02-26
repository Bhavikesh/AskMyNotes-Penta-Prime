"""
Router: /subjects — create, list, delete subjects (max 3 per user).
"""
from fastapi import APIRouter, HTTPException
from app.models.subject_models import SubjectCreate, SubjectListResponse, SubjectResponse
from app.services.subject_manager import SubjectManager

router = APIRouter()
manager = SubjectManager()


@router.post("/", response_model=SubjectResponse, summary="Create a subject (max 3 per user)")
async def create_subject(payload: SubjectCreate):
    """Create a new subject for the user. Maximum 3 subjects allowed."""
    return await manager.create_subject(str(payload.user_id), payload.name)


@router.get("/", response_model=SubjectListResponse, summary="List all subjects for a user")
async def list_subjects(user_id: str):
    """List all subjects belonging to the user."""
    return await manager.list_subjects(user_id)


@router.delete("/{subject_id}", summary="Delete a subject")
async def delete_subject(subject_id: str, user_id: str):
    """
    Delete a subject and all its documents/chunks (cascade in Supabase).
    Pass `user_id` as a query parameter.
    """
    await manager.delete_subject(user_id, subject_id)
    return {"message": f"Subject '{subject_id}' deleted successfully."}
