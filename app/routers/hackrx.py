from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import List, Optional
import logging
from ..models.request_models import HackRXRequest
from ..models.response_models import HackRXResponse
from ..services.query_processor import QueryProcessor
from ..services.document_manager import DocumentManager
from ..config import get_settings

logger = logging.getLogger(__name__)
router = APIRouter()
settings = get_settings()

# Security scheme
security = HTTPBearer()

# Document manager
doc_manager = DocumentManager()

async def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Verify bearer token"""
    token = credentials.credentials
    
    if token != settings.BEARER_TOKEN:
        raise HTTPException(
            status_code=401,
            detail="Invalid authentication token"
        )
    
    return token

@router.post("/run", response_model=HackRXResponse)
async def process_hackrx_request(
    request: HackRXRequest,
    token: str = Depends(verify_token)
):
    """
    Main endpoint for document processing.
    
    Supports two modes:
    1. document_url: Direct URL to document
    2. document_id: ID of document from database/uploads
    
    Expected request format:
    {
        "document_url": "https://..." OR "document_id": "abc123",
        "questions": ["question1", "question2", ...]
    }
    
    Returns:
    {
        "answers": ["answer1", "answer2", ...]
    }
    """
    try:
        # Determine document source
        if hasattr(request, 'document_id') and request.document_id:
            # Get document path from ID
            doc_path = doc_manager.get_document_path(request.document_id)
            
            if not doc_path:
                raise HTTPException(
                    status_code=404, 
                    detail=f"Document not found: {request.document_id}"
                )
            
            # Convert local path to file:// URL for consistency
            document_source = f"file://{doc_path}"
            logger.info(f"Processing document from ID: {request.document_id}")
        
        else:
            # Use direct URL
            document_source = str(request.document_url)
            logger.info(f"Processing document from URL: {document_source[:100]}...")
        
        logger.info(f"Received request with {len(request.questions)} questions")
        
        # Initialize processor
        processor = QueryProcessor()
        
        # Process document and queries
        answers = await processor.process_document_and_queries(
            document_source,
            request.questions
        )
        
        logger.info(f"Successfully processed {len(answers)} answers")
        
        return HackRXResponse(answers=answers)
    
    except HTTPException:
        raise
    
    except Exception as e:
        logger.error(f"Request processing failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Processing failed: {str(e)}")
