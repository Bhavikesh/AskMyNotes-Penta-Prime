"""
Router: /analytics — subject-wise performance and timeline data.
"""
from fastapi import APIRouter, HTTPException
from app.models.askmynotes_models import AnalyticsResponse
from app.services.analytics_service import AnalyticsService

router = APIRouter()
analytics_svc = AnalyticsService()


@router.get("/performance", response_model=AnalyticsResponse, summary="Get performance analytics")
async def get_performance(user_id: str):
    """
    Returns per-subject accuracy, question counts, average confidence,
    and a daily timeline of query accuracy for the given user.
    """
    if not user_id:
        raise HTTPException(status_code=400, detail="user_id is required")
    try:
        return await analytics_svc.get_performance(user_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analytics error: {str(e)}")
