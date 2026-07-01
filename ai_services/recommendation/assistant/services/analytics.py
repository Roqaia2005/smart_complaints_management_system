"""
Target path: assistant/services/analytics.py  (REPLACES existing file)

Read-only adapter from existing DSS analytics into assistant snapshots.

CHANGES IN THIS VERSION
------------------------
1. FIXED: _build_snapshot() was calling fetch_complaints(db) with NO
   faculty_id, then manually querying Category to get this faculty's
   category ids and filtering the dataframe in Python afterward. Since
   fetch_complaints() pulls the 200 most recent complaints SYSTEM-WIDE
   before any faculty filter is applied, a faculty whose complaints
   weren't among the globally most-recent 200 could get an empty or
   badly incomplete snapshot -- the exact same bug fixed in
   recommendation.py's run_recommendation_pipeline().

   fetch_complaints() already supports faculty-scoped filtering at the
   SQL level (filtering happens via a JOIN on categories.faculty_id
   BEFORE the LIMIT is applied) -- see recommendation.py. This version
   just calls it directly with faculty_id, which also removes the need
   for the separate Category query entirely.

2. Faculty-scoped caching (carried over from the previous edit, now
   correct): the snapshot cache key includes faculty_id, so managers
   from different faculties never share a cached snapshot.

3. force_refresh continues to work as before, now via the faculty-scoped
   cache key.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from fastapi import HTTPException
from sqlalchemy.orm import Session

from dss_analytics import (
    build_category_insights,
    build_category_risk_ranking,
    build_dashboard_metrics,
    build_executive_summary,
    generate_smart_alerts,
)
from models import AiRecommendation
from recommendation import compute_statistics, extract_keywords, fetch_complaints

from assistant.config import ANALYTICS_CACHE_TTL_SECONDS
from assistant.services.cache import TTLCache

_SNAPSHOT_CACHE = TTLCache(ttl_seconds=ANALYTICS_CACHE_TTL_SECONDS)


def build_assistant_analytics_snapshot(
    db: Session,
    faculty_id: int,
    force_refresh: bool = False,
) -> dict[str, Any]:
    """Build (or reuse a cached) faculty-scoped DSS snapshot for the assistant.

    This is a potentially slow, fully synchronous operation (DB query +
    Groq translation calls + TF-IDF + analytical engines). Callers from
    `async def` routes MUST run this via `asyncio.to_thread(...)` rather
    than awaiting it directly, or it will block the event loop for every
    other in-flight request. See assistant/routes.py for the fix.

    faculty_id is required (not Optional) because the voice briefing is a
    GENERATION endpoint -- assistant/routes.py rejects the request with
    403 before calling this if the requesting manager has no faculty_id,
    matching the same policy used by /api/chat/recommendations.
    """
    cache_key = f"assistant_snapshot_faculty_{faculty_id}"
    if force_refresh:
        _SNAPSHOT_CACHE.invalidate(cache_key)
    return _SNAPSHOT_CACHE.get_or_set(cache_key, lambda: _build_snapshot(db, faculty_id))


def _build_snapshot(db: Session, faculty_id: int) -> dict[str, Any]:
    """Read-only adapter from existing DSS analytics into assistant snapshots.

    Faculty filtering happens at the SQL level inside fetch_complaints()
    (via a JOIN on categories.faculty_id, applied before the row LIMIT) --
    see recommendation.py. No separate category lookup or dataframe
    post-filtering is needed here.
    """
    df = fetch_complaints(db, faculty_id=faculty_id)
    if df.empty:
        raise HTTPException(status_code=404, detail="No complaint data available for this faculty")

    stats_df = compute_statistics(df)
    if stats_df.empty:
        raise HTTPException(status_code=404, detail="No category has enough complaint data")

    keywords_by_category: dict[int, list[str]] = {}
    for _, row in stats_df.iterrows():
        category_id = int(row["category_id"])
        category_df = df[df["category_id"] == category_id]
        keywords_by_category[category_id] = extract_keywords(category_df["problem"].tolist())

    insights = build_category_insights(df, stats_df, keywords_by_category)
    alerts = generate_smart_alerts(df, stats_df, insights)
    dashboard = build_dashboard_metrics(df, stats_df, insights)
    risk_ranking = build_category_risk_ranking(insights)
    executive_summary = build_executive_summary(df, stats_df, insights, alerts)
    recommendations = _load_recommendations(db, faculty_id)

    return {
        "generated_at": datetime.utcnow().isoformat(),
        "dashboard": dashboard,
        "risk_ranking": risk_ranking,
        "executive_summary": executive_summary,
        "alerts": alerts,
        "recommendations": recommendations,
        "category_details": {
            str(category_id): _serialize_category_detail(detail)
            for category_id, detail in insights.items()
        },
    }


def _load_recommendations(db: Session, faculty_id: int) -> list[dict[str, Any]]:
    rows = (
        db.query(AiRecommendation)
        .filter(AiRecommendation.faculty_id == faculty_id)
        .order_by(AiRecommendation.generated_at.desc().nullslast())
        .limit(20)
        .all()
    )
    return [
        {
            "id": row.id,
            "category_id": row.category_id,
            "category_name": row.category_name,
            "pattern_detected": row.pattern_detected,
            "recommendation": row.recommendation,
            "root_cause": row.root_cause,
            "urgency": row.urgency,
            "estimated_impact": row.estimated_impact,
            "location": row.location,
        }
        for row in rows
    ]


def _serialize_category_detail(detail: dict[str, Any]) -> dict[str, Any]:
    return {
        "category_name": detail.get("category_name"),
        "risk": detail.get("risk"),
        "root_cause_analysis": detail.get("root_cause_analysis"),
        "trend": detail.get("trend"),
        "resolution_quality": detail.get("resolution_quality"),
        "location_intelligence": detail.get("location_intelligence"),
        "decision_priority": detail.get("decision_priority"),
        "prediction": detail.get("prediction"),
        "alerts": detail.get("alerts"),
    }