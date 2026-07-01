"""
Target path: dss_routes.py  (REPLACES existing file)

FastAPI endpoints for Decision Support System insights.

CHANGES IN THIS VERSION
------------------------
1. CACHING (from the previous round): _load_dss_context() is wrapped in a
   short-TTL cache so a single dashboard page load doesn't re-run the
   full analytical pipeline once per widget.

2. FACULTY DATA ISOLATION (this round): every endpoint here previously
   showed EVERY faculty's complaint data to EVERY manager -- the
   dashboard, risk ranking, executive summary, alerts, and per-category
   insight were completely unscoped, even though
   /api/manager/recommendations (recommendation.py) had already been
   fixed to isolate by faculty.

   Policy used here (READ endpoints), matching the existing precedent in
   recommendation.py's list_recommendations(): if the requesting user has
   a faculty_id, all data is filtered to that faculty. If they don't
   (e.g. an admin/super_admin not tied to one faculty), they see the
   global, unscoped view -- same fallback behavior
   list_recommendations() already uses. This is an ASSUMPTION carried
   over from your own codebase's existing pattern; if admins should also
   be forced into a single faculty or blocked entirely without one, that
   policy needs to change here (and in list_recommendations for
   consistency).

   Filtering happens via fetch_complaints(db, faculty_id=...), which
   filters at the SQL level (JOIN on categories.faculty_id, before the
   row LIMIT) -- see recommendation.py. This avoids the "LIMIT 200
   truncates before the faculty filter runs" bug that was fixed
   elsewhere in this same round.

   The cache key now includes faculty_id (or "global" when None), so
   managers from different faculties never share a cached DSS context --
   this was flagged as a risk when the cache was first added and is now
   addressed.

Backward Compatibility
----------------------
All existing endpoints, response schemas, and field names are preserved.
New fields are added as *optional* -- existing frontend code continues working.
"""

import logging
from datetime import datetime
from typing import Any, Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from assistant.services.auth import authenticate_assistant_user, get_user_faculty_id
from assistant.services.cache import TTLCache
from assistant.config import ANALYTICS_CACHE_TTL_SECONDS
from database import get_db
from dss_analytics import (
    build_category_insights,
    build_category_risk_ranking,
    build_dashboard_metrics,
    build_executive_summary,
    generate_smart_alerts,
)
from recommendation import compute_statistics, extract_keywords, fetch_complaints

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/dss", tags=["DSS"])

_DSS_CONTEXT_CACHE = TTLCache(ttl_seconds=ANALYTICS_CACHE_TTL_SECONDS)


# ─────────────────────────────────────────────
# Response schemas (unchanged)
# ─────────────────────────────────────────────

class RiskRankingItem(BaseModel):
    rank: int
    category_id: int
    category_name: str
    risk_score: float
    risk_level: str
    unresolved_count: int
    complaint_count: int
    appeal_rate_pct: float
    high_priority_pct: float
    dominant_location: str
    hotspot_location: Optional[str] = None
    hotspot_share_pct: Optional[float] = None
    confidence_score: Optional[int] = None
    confidence_level: Optional[str] = None
    decision_priority_score: Optional[int] = None
    decision_priority_level: Optional[str] = None


class DashboardMetrics(BaseModel):
    total_complaints: int
    unresolved_complaints: int
    resolved_complaints: int
    overall_risk_score: float
    overall_risk_level: str
    categories_analyzed: int
    categories_above_threshold: int
    high_priority_unresolved: int
    avg_appeal_rate_pct: float
    top_hotspot_location: str
    generated_at: str
    avg_risk_trend: Optional[dict] = None
    resolution_quality: Optional[dict] = None
    prediction_summary: Optional[dict] = None
    highest_confidence_root_cause: Optional[dict] = None
    fastest_improving_category: Optional[dict] = None
    fastest_deteriorating_category: Optional[dict] = None
    avg_root_cause_confidence: Optional[float] = None
    analytics_metadata: Optional[dict] = None


class ExecutiveSummaryOut(BaseModel):
    summary: str
    key_findings: list[str]
    overall_risk_score: float
    overall_risk_level: str
    generated_at: str
    operational_health: Optional[dict] = None
    biggest_risk: Optional[dict] = None
    biggest_improvement: Optional[dict] = None
    worst_trend: Optional[dict] = None
    prediction_summary: Optional[dict] = None
    most_reliable_root_cause: Optional[dict] = None
    immediate_actions: Optional[list[str]] = None
    analytics_metadata: Optional[dict] = None


class SmartAlert(BaseModel):
    severity: str
    category_id: int
    category_name: str
    alert_type: str
    message: str
    metric_value: float
    reason: Optional[str] = None
    recommended_action: Optional[str] = None


class CategoryInsightOut(BaseModel):
    category_id: int
    category_name: str
    risk_score: float
    risk_level: str
    unresolved_count: int
    complaint_count: int
    appeal_rate_pct: float
    high_priority_pct: float
    findings: list[str]
    confident_root_cause: Optional[str] = None
    dominant_keywords: list[str] = []
    risk_breakdown: Optional[dict] = None
    confidence_score: Optional[int] = None
    confidence_level: Optional[str] = None
    root_cause_evidence: Optional[list[dict]] = None
    trend: Optional[dict] = None
    resolution_quality: Optional[dict] = None
    location_intelligence: Optional[list[dict]] = None
    temporal_intelligence: Optional[dict] = None
    evidence_package: Optional[dict] = None
    prediction: Optional[dict] = None
    decision_priority: Optional[dict] = None
    supporting_metrics: Optional[dict] = None
    alerts: Optional[list[dict]] = None
    analytics_metadata: Optional[dict] = None


# ─────────────────────────────────────────────
# Shared DSS data loader (cached, faculty-scoped)
# ─────────────────────────────────────────────

def _cache_key(faculty_id: Optional[int]) -> str:
    return f"dss_context_faculty_{faculty_id}" if faculty_id is not None else "dss_context_global"


def _load_dss_context(db: Session, faculty_id: Optional[int], force_refresh: bool = False):
    """Fetch complaints and run the full analytical layer, cached for
    ANALYTICS_CACHE_TTL_SECONDS and scoped per faculty so a single
    dashboard load doesn't pay the full pipeline cost once per widget,
    and so managers from different faculties never share a cached
    context.

    faculty_id=None means an unscoped/global view (see module docstring
    for when that applies).
    """
    key = _cache_key(faculty_id)
    if force_refresh:
        _DSS_CONTEXT_CACHE.invalidate(key)
    return _DSS_CONTEXT_CACHE.get_or_set(key, lambda: _build_dss_context(db, faculty_id))


def _build_dss_context(db: Session, faculty_id: Optional[int]):
    # Faculty filtering happens at the SQL level inside fetch_complaints()
    # (JOIN on categories.faculty_id, applied before the row LIMIT) --
    # avoids the truncate-before-filter bug fixed elsewhere this round.
    df = fetch_complaints(db, faculty_id=faculty_id)
    if df.empty:
        return None

    stats_df = compute_statistics(df)
    if stats_df.empty:
        return {"df": df, "stats_df": stats_df, "insights": {}, "alerts": []}

    keywords_by_category = {}
    for _, row in stats_df.iterrows():
        cat_id = int(row["category_id"])
        mask = df["category_id"] == cat_id
        keywords_by_category[cat_id] = extract_keywords(df[mask]["problem"].tolist())

    insights = build_category_insights(df, stats_df, keywords_by_category)
    alerts = generate_smart_alerts(df, stats_df, insights)

    return {
        "df": df,
        "stats_df": stats_df,
        "insights": insights,
        "alerts": alerts,
    }


# ─────────────────────────────────────────────
# Endpoints
# ─────────────────────────────────────────────

@router.get("/dashboard", response_model=DashboardMetrics)
def get_dashboard_metrics(
    db: Session = Depends(get_db),
    authorization: str | None = Header(default=None),
):
    """Overall DSS dashboard metrics for management visualization.
    Scoped to the requesting manager's faculty."""
    current_user = authenticate_assistant_user(db=db, authorization=authorization)
    faculty_id = get_user_faculty_id(db, current_user.id)
    ctx = _load_dss_context(db, faculty_id)
    if ctx is None:
        raise HTTPException(status_code=404, detail="No complaint data available")

    return build_dashboard_metrics(ctx["df"], ctx["stats_df"], ctx["insights"])


@router.get("/risk-ranking", response_model=list[RiskRankingItem])
def get_category_risk_ranking(
    db: Session = Depends(get_db),
    authorization: str | None = Header(default=None),
):
    """Category risk ranking sorted by operational risk score.
    Scoped to the requesting manager's faculty."""
    current_user = authenticate_assistant_user(db=db, authorization=authorization)
    faculty_id = get_user_faculty_id(db, current_user.id)
    ctx = _load_dss_context(db, faculty_id)
    if ctx is None:
        raise HTTPException(status_code=404, detail="No complaint data available")

    return build_category_risk_ranking(ctx["insights"])


@router.get("/executive-summary", response_model=ExecutiveSummaryOut)
def get_executive_summary(
    db: Session = Depends(get_db),
    authorization: str | None = Header(default=None),
):
    """Data-driven executive summary for management review.
    Scoped to the requesting manager's faculty."""
    current_user = authenticate_assistant_user(db=db, authorization=authorization)
    faculty_id = get_user_faculty_id(db, current_user.id)
    ctx = _load_dss_context(db, faculty_id)
    if ctx is None:
        raise HTTPException(status_code=404, detail="No complaint data available")

    return build_executive_summary(
        ctx["df"], ctx["stats_df"], ctx["insights"], ctx["alerts"]
    )


@router.get("/alerts", response_model=list[SmartAlert])
def get_smart_alerts(
    db: Session = Depends(get_db),
    authorization: str | None = Header(default=None),
):
    """Threshold-based smart alerts for proactive management.
    Scoped to the requesting manager's faculty."""
    current_user = authenticate_assistant_user(db=db, authorization=authorization)
    faculty_id = get_user_faculty_id(db, current_user.id)
    ctx = _load_dss_context(db, faculty_id)
    if ctx is None:
        raise HTTPException(status_code=404, detail="No complaint data available")

    return ctx["alerts"]


@router.get("/category/{category_id}", response_model=CategoryInsightOut)
def get_category_insight(
    category_id: int,
    db: Session = Depends(get_db),
    authorization: str | None = Header(default=None),
):
    """Detailed DSS insight for a single complaint category.
    Scoped to the requesting manager's faculty -- a category belonging to
    a different faculty will not appear in the faculty-filtered insights
    and correctly 404s below, without revealing that it exists elsewhere."""
    current_user = authenticate_assistant_user(db=db, authorization=authorization)
    faculty_id = get_user_faculty_id(db, current_user.id)
    ctx = _load_dss_context(db, faculty_id)
    if ctx is None:
        raise HTTPException(status_code=404, detail="No complaint data available")

    insight = ctx["insights"].get(category_id)
    if not insight:
        raise HTTPException(
            status_code=404,
            detail=f"No analytical data for category {category_id} (requires 5+ complaints)",
        )

    risk = insight["risk"]
    rca = insight["root_cause_analysis"]
    stats = insight["stats"]

    category_alerts = [
        a for a in ctx.get("alerts", [])
        if a.get("category_id") == category_id
    ]

    return CategoryInsightOut(
        category_id=category_id,
        category_name=insight["category_name"],
        risk_score=risk["risk_score"],
        risk_level=risk["risk_level"],
        unresolved_count=risk["unresolved_count"],
        complaint_count=stats["complaint_count"],
        appeal_rate_pct=stats["appeal_rate_pct"],
        high_priority_pct=stats["high_priority_pct"],
        findings=rca.get("findings", []),
        confident_root_cause=rca.get("confident_root_cause"),
        dominant_keywords=rca.get("dominant_keywords", []),
        risk_breakdown=risk.get("risk_breakdown"),
        confidence_score=rca.get("confidence_score"),
        confidence_level=rca.get("confidence_level"),
        root_cause_evidence=rca.get("root_cause_evidence"),
        trend=insight.get("trend"),
        resolution_quality=insight.get("resolution_quality"),
        location_intelligence=insight.get("location_intelligence"),
        temporal_intelligence=insight.get("temporal_intelligence"),
        evidence_package=insight.get("evidence_package"),
        prediction=insight.get("prediction"),
        decision_priority=insight.get("decision_priority"),
        supporting_metrics=insight.get("evidence_package", {}).get("supporting_metrics"),
        alerts=category_alerts,
        analytics_metadata=insight.get("analytics_metadata"),
    )