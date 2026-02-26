from fastapi import APIRouter, HTTPException
import logging

from app.services.document_manager import DocumentManager

router = APIRouter()
logger = logging.getLogger(__name__)

doc_manager = DocumentManager()


@router.get("/")
async def list_documents():
    """Return list of all available documents."""
    documents = doc_manager. list_available_documents()
    return {"documents": documents, "count": len(documents)}


@router.get("/{document_id}")
async def get_document(document_id: str):
    """Return metadata for a specific document."""
    doc = doc_manager.get_document_by_id(document_id)
    if not doc:
        raise HTTPException(status_code=404, detail=f"Document not found: {document_id}")
    return doc


@router.delete("/{document_id}")
async def delete_document(document_id: str):
    """Delete an uploaded document."""
    doc = doc_manager. get_document_by_id(document_id)
    if not doc:
        raise HTTPException(status_code=404, detail=f"Document not found: {document_id}")
    
    if doc.get("source") != "upload":
        raise HTTPException(
            status_code=403,
            detail="Cannot delete dataset documents.  Only uploaded documents can be deleted."
        )
    
    success = doc_manager.delete_uploaded_document(document_id)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to delete document")
    
    logger.info(f"Deleted document {document_id}")
    return {"message": "Document deleted successfully", "document_id": document_id}