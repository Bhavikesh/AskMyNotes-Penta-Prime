"""
Router: /upload — upload a document and ingest it into AskMyNotes.

Each upload is associated with a user_id and subject_id.
The file is parsed, chunked, embedded into FAISS, and metadata is
persisted in Supabase.
"""
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from pathlib import Path
import datetime
import logging
from typing import Optional

from app.services.subject_manager import SubjectManager
from app.services.rag_service import RAGService

router = APIRouter()
logger = logging.getLogger(__name__)

UPLOADS_DIR = Path("uploads")
UPLOADS_DIR.mkdir(exist_ok=True)

subject_mgr = SubjectManager()
rag_service = RAGService()

ALLOWED_EXTENSIONS = {".pdf", ".docx", ".eml", ".txt"}


@router.post("/", summary="Upload a document to a subject")
async def upload_document(
    file: UploadFile = File(...),
    user_id: str = Form(..., description="User UUID"),
    subject_id: str = Form(..., description="Subject UUID to attach this document to"),
):
    """
    Upload a document and ingest it into AskMyNotes.

    - Validates the subject belongs to the user.
    - Parses, chunks, and embeds the document.
    - Stores chunk metadata in Supabase and vectors in FAISS.
    """
    # 1. Validate file type
    file_ext = Path(file.filename).suffix.lower()
    if file_ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"File type '{file_ext}' not allowed. Allowed: {', '.join(ALLOWED_EXTENSIONS)}",
        )

    # 2. Validate subject ownership (with retry on connection error)
    try:
        await subject_mgr.get_subject(user_id, subject_id)
    except HTTPException:
        raise
    except (ConnectionError, OSError) as e:
        # Stale connection — reconnect and retry once
        from app.services.supabase_service import SupabaseService
        SupabaseService().reconnect()
        try:
            await subject_mgr.get_subject(user_id, subject_id)
        except HTTPException:
            raise
        except Exception as e2:
            raise HTTPException(status_code=500, detail=f"Subject validation failed after retry: {e2}")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Subject validation failed: {e}")

    # 3. Save file to disk
    timestamp = datetime.datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    original_stem = Path(file.filename).stem
    safe_filename = f"{original_stem}_{timestamp}{file_ext}"
    save_path = UPLOADS_DIR / safe_filename

    try:
        content = await file.read()
        with save_path.open("wb") as f:
            f.write(content)
        logger.info(f"Saved uploaded file: {save_path}")
    except Exception as exc:
        logger.exception(f"Failed to save upload: {exc}")
        raise HTTPException(status_code=500, detail=f"Failed to save file: {exc}")

    # 4. Ingest: parse → chunk → embed → FAISS + Supabase
    try:
        stats = await rag_service.ingest_document(
            user_id=user_id,
            subject_id=subject_id,
            file_path=str(save_path),
            file_name=safe_filename,
        )
    except Exception as exc:
        logger.exception(f"Ingestion failed: {exc}")
        save_path.unlink(missing_ok=True)
        raise HTTPException(status_code=500, detail=f"Document ingestion failed: {exc}")

    return {
        "message": "Upload and ingestion successful",
        "filename": safe_filename,
        "document_id": stats.get("document_id"),
        "chunks_created": stats.get("chunks_created"),
        "subject_id": subject_id,
        "user_id": user_id,
    }


@router.get("/allowed-types")
async def get_allowed_types():
    return {"allowed_types": list(ALLOWED_EXTENSIONS), "max_size_mb": 50}
