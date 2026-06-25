"""
dss_routes.py
=============
FastAPI endpoints for Decision Support System insights.

These endpoints expose management analytics suitable for dashboards and charts.
They share the same analytical engine as the recommendation pipeline.
"""

import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

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


# ─────────────────────────────────────────────
# Response schemas
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


class ExecutiveSummaryOut(BaseModel):
    summary: str
    key_findings: list[str]
    overall_risk_score: float
    overall_risk_level: str
    generated_at: str


class SmartAlert(BaseModel):
    severity: str
    category_id: int
    category_name: str
    alert_type: str
    message: str
    metric_value: float


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


# ─────────────────────────────────────────────
# Shared DSS data loader
# ─────────────────────────────────────────────

def _load_dss_context(db: Session):
    """Fetch complaints and run the full analytical layer."""
    df = fetch_complaints(db)
    if df.empty:
        return None

    stats_df = compute_statistics(df)
    if stats_df.empty:
        return {"df": df, "stats_df": stats_df, "insights": {}, "alerts": []}

    # Pre-compute TF-IDF keywords per category (same as pipeline)
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
def get_dashboard_metrics(db: Session = Depends(get_db)):
    """Overall DSS dashboard metrics for management visualization."""
    ctx = _load_dss_context(db)
    if ctx is None:
        raise HTTPException(status_code=404, detail="No complaint data available")

    return build_dashboard_metrics(ctx["df"], ctx["stats_df"], ctx["insights"])


@router.get("/risk-ranking", response_model=list[RiskRankingItem])
def get_category_risk_ranking(db: Session = Depends(get_db)):
    """Category risk ranking sorted by operational risk score."""
    ctx = _load_dss_context(db)
    if ctx is None:
        raise HTTPException(status_code=404, detail="No complaint data available")

    return build_category_risk_ranking(ctx["insights"])


@router.get("/executive-summary", response_model=ExecutiveSummaryOut)
def get_executive_summary(db: Session = Depends(get_db)):
    """Data-driven executive summary for management review."""
    ctx = _load_dss_context(db)
    if ctx is None:
        raise HTTPException(status_code=404, detail="No complaint data available")

    return build_executive_summary(
        ctx["df"], ctx["stats_df"], ctx["insights"], ctx["alerts"]
    )


@router.get("/alerts", response_model=list[SmartAlert])
def get_smart_alerts(db: Session = Depends(get_db)):
    """Threshold-based smart alerts for proactive management."""
    ctx = _load_dss_context(db)
    if ctx is None:
        raise HTTPException(status_code=404, detail="No complaint data available")

    return ctx["alerts"]


@router.get("/category/{category_id}", response_model=CategoryInsightOut)
def get_category_insight(category_id: int, db: Session = Depends(get_db)):
    """Detailed DSS insight for a single complaint category."""
    ctx = _load_dss_context(db)
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
    )
