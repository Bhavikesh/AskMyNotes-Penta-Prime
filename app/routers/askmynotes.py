"""
Router: /askmynotes — subject-scoped question answering with citations.
"""
from fastapi import APIRouter, HTTPException
from app.models.askmynotes_models import AskMyNotesQueryRequest, AskMyNotesQueryResponse
from app.services.rag_service import RAGService
from app.services.subject_manager import SubjectManager

router = APIRouter()
rag = RAGService()
subject_mgr = SubjectManager()


@router.post("/query", response_model=AskMyNotesQueryResponse, summary="Ask a question about a subject")
async def query_notes(payload: AskMyNotesQueryRequest):
    """
    Ask a question scoped to a specific subject.

    - Returns a grounded answer with confidence, citations, and evidence.
    - Returns "Not found in your notes for [Subject]" if no relevant content is found.
    """
    # Validate subject ownership
    subject_row = await subject_mgr.get_subject(str(payload.user_id), str(payload.subject_id))
    subject_name = subject_row["name"]

    try:
        history = [{"role": t.role, "content": t.content} for t in payload.conversation_history]
        result = await rag.query(
            user_id=str(payload.user_id),
            subject_id=str(payload.subject_id),
            subject_name=subject_name,
            question=payload.question,
            conversation_history=history,
            voice_mode=payload.voice_mode,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Query failed: {str(e)}")

    return result
