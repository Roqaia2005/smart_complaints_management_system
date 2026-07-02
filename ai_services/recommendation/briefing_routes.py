"""
briefing_routes.py
==================
FastAPI endpoints for the Executive Briefing feature.

This module provides a simple, reliable briefing system that reads out
existing DSS analytics using TTS. No complex dialogue generation or
conversation management.
"""

import logging
from typing import Any, Optional

from kokoro_provider import KokoroTTSProvider
from edge_provider import EdgeTTSProvider
from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from auth import authenticate_recommendation_user, get_user_faculty_id
from briefing import build_executive_briefing, format_briefing_for_tts
from config import GROQ_MODEL, GROQ_TIMEOUT_SECONDS, TTS_PROVIDER_CHAIN, AUDIO_CACHE_DIR
from database import get_db
from dss_routes import (
    _load_dss_context,
    get_smart_alerts,
)
from dss_analytics import build_executive_summary, build_dashboard_metrics, build_category_risk_ranking
from recommendation import router as recommendation_router
from recommendation import list_recommendations
from tts_manager import TTSProviderManager

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/briefing", tags=["Executive Briefing"])


# ─────────────────────────────────────────────
# Request/Response schemas
# ─────────────────────────────────────────────

class BriefingRequest(BaseModel):
    """Request for executive briefing - no parameters needed, uses user's faculty context."""
    pass


class BriefingSection(BaseModel):
    """A single section of the executive briefing."""
    section: str
    text: str


class BriefingResponse(BaseModel):
    """Complete executive briefing response."""
    sections: list[BriefingSection]
    full_text: str
    faculty_id: Optional[int] = None


class BriefingAudioRequest(BaseModel):
    """Request to generate TTS audio for briefing."""
    voice: Optional[str] = "en-US-JennyNeural"  # Default professional voice
    speed: Optional[float] = 1.0


class BriefingAudioResponse(BaseModel):
    """Response with TTS audio URL for briefing."""
    audio_url: Optional[str]
    sections: list[BriefingSection]
    duration_estimate: Optional[int] = None  # Estimated duration in seconds


# ─────────────────────────────────────────────
# Helper function to gather all analytics
# ─────────────────────────────────────────────

def _gather_analytics(db: Session, faculty_id: Optional[int]) -> dict[str, Any]:
    """Gather all required analytics for the briefing.
    
    Parameters
    ----------
    db : Session
        Database session
    faculty_id : int or None
        Faculty ID for data isolation
    
    Returns
    -------
    dict
        Dictionary containing all analytics needed for briefing
    """
    # Load DSS context (cached)
    ctx = _load_dss_context(db, faculty_id)
    
    if ctx is None:
        # Return empty analytics if no data
        return {
            "dashboard_metrics": {},
            "risk_ranking": [],
            "executive_summary": {},
            "alerts": [],
            "recommendations": []
        }
    
    # Extract dashboard metrics
    dashboard_metrics = build_dashboard_metrics(ctx["df"], ctx["stats_df"], ctx["insights"])
    
    # Extract risk ranking
    risk_ranking = build_category_risk_ranking(ctx["insights"])
    
    # Extract executive summary
    executive_summary = build_executive_summary(
        ctx["df"], ctx["stats_df"], ctx["insights"], ctx["alerts"]
    )
    
    # Alerts are already in context
    alerts = ctx["alerts"]
    
    # Get recommendations (filtered by faculty)
    recommendations = []
    try:
        # Use the recommendation router's list_recommendations function
        # We need to call it directly since we can't use Depends here
        from models import AiRecommendation
        query = db.query(AiRecommendation)
        
        # Filter by faculty if provided
        if faculty_id is not None:
            query = query.filter(AiRecommendation.faculty_id == faculty_id)
        
        recs = query.order_by(AiRecommendation.generated_at.desc()).limit(5).all()
        
        # Convert to dict format
        for rec in recs:
            recommendations.append({
                "id": rec.id,
                "category_id": rec.category_id,
                "category_name": rec.category_name,
                "recommendation": rec.recommendation,
                "estimated_impact": rec.estimated_impact,
                "urgency": rec.urgency,
                "status": rec.status,
            })
    except Exception as exc:
        logger.warning(f"Could not fetch recommendations: {exc}")
    
    return {
        "dashboard_metrics": dashboard_metrics,
        "risk_ranking": risk_ranking,
        "executive_summary": executive_summary,
        "alerts": alerts,
        "recommendations": recommendations
    }


# ─────────────────────────────────────────────
# Endpoints
# ─────────────────────────────────────────────

@router.post("/generate", response_model=BriefingResponse)
def generate_briefing(
    db: Session = Depends(get_db),
    authorization: Optional[str] = Header(default=None),
):
    """Generate an executive briefing from current DSS analytics.
    
    This endpoint gathers all relevant analytics and builds a structured
    briefing that can be read aloud or displayed in the UI.
    
    Authentication: Requires manager, admin, or super_admin role.
    Data isolation: Scoped to the requesting user's faculty.
    """
    # Authenticate user
    current_user = authenticate_recommendation_user(db=db, authorization=authorization)
    
    # Get user's faculty_id for data isolation
    faculty_id = get_user_faculty_id(db, current_user.id)
    
    # Gather all analytics
    analytics = _gather_analytics(db, faculty_id)
    
    # Build briefing sections
    sections = build_executive_briefing(
        dashboard_metrics=analytics["dashboard_metrics"],
        risk_ranking=analytics["risk_ranking"],
        executive_summary=analytics["executive_summary"],
        alerts=analytics["alerts"],
        recommendations=analytics["recommendations"]
    )
    
    # Format full text
    full_text = format_briefing_for_tts(sections)
    
    logger.info(f"Generated executive briefing with {len(sections)} sections for user {current_user.id}")
    
    return BriefingResponse(
        sections=[BriefingSection(**s) for s in sections],
        full_text=full_text,
        faculty_id=faculty_id
    )


@router.post("/audio", response_model=BriefingAudioResponse)
def generate_briefing_audio(
    request: BriefingAudioRequest,
    db: Session = Depends(get_db),
    authorization: Optional[str] = Header(default=None),
):
    """Generate TTS audio for the executive briefing.
    
    This endpoint generates audio for the complete briefing using TTS.
    The audio is cached for subsequent requests.
    
    Authentication: Requires manager, admin, or super_admin role.
    Data isolation: Scoped to the requesting user's faculty.
    """
    # Authenticate user
    current_user = authenticate_recommendation_user(db=db, authorization=authorization)
    
    # Get user's faculty_id for data isolation
    faculty_id = get_user_faculty_id(db, current_user.id)
    
    # Gather all analytics
    analytics = _gather_analytics(db, faculty_id)
    
    # Build briefing sections
    sections = build_executive_briefing(
        dashboard_metrics=analytics["dashboard_metrics"],
        risk_ranking=analytics["risk_ranking"],
        executive_summary=analytics["executive_summary"],
        alerts=analytics["alerts"],
        recommendations=analytics["recommendations"]
    )
    
    # Format full text for TTS
    full_text = format_briefing_for_tts(sections)
    
    # Generate TTS audio
    audio_url = None
    try:
        import asyncio
        
        async def generate_audio():
            # Create TTS manager with provider chain
            providers = []
            
            # Import providers based on configuration
            for provider_key in TTS_PROVIDER_CHAIN:
                if provider_key == "edge":
                    try:
                        providers.append(EdgeTTSProvider())
                    except Exception:
                        logger.warning("Edge TTS provider not available")
                elif provider_key == "kokoro":
                    try:
                        providers.append(KokoroTTSProvider())
                    except Exception:
                        logger.warning("Kokoro TTS provider not available")
            
            if not providers:
                logger.warning("No TTS providers available")
                return None
            
            manager = TTSProviderManager(providers, audio_cache_dir=AUDIO_CACHE_DIR)
            return await manager.generate_audio(full_text, "briefing")
        
        audio_url = asyncio.run(generate_audio())
        if audio_url:
            logger.info(f"Generated TTS audio for briefing: {audio_url}")
        else:
            logger.warning("TTS generation returned no audio - text-only briefing")
            
    except Exception as exc:
        logger.error(f"Error in audio generation: {exc}")
    
    # Estimate duration (roughly 150 words per minute for professional speech)
    word_count = len(full_text.split())
    duration_estimate = int((word_count / 150) * 60 / request.speed) if request.speed > 0 else 0
    
    return BriefingAudioResponse(
        audio_url=audio_url,
        sections=[BriefingSection(**s) for s in sections],
        duration_estimate=duration_estimate
    )


@router.get("/status")
def briefing_status(
    db: Session = Depends(get_db),
    authorization: Optional[str] = Header(default=None),
):
    """Check if briefing service is available.
    
    Returns status information about the briefing service.
    """
    # Authenticate user (lightweight check)
    try:
        authenticate_recommendation_user(db=db, authorization=authorization)
        return {
            "status": "available",
            "service": "Executive Briefing",
            "features": {
                "text_briefing": True,
                "tts_audio": True,
                "sections": True
            }
        }
    except HTTPException:
        # Return public status without revealing auth details
        return {
            "status": "available",
            "service": "Executive Briefing",
            "authenticated": False
        }