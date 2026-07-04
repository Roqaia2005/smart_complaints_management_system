"""
recommendation.py
=================
Full recommendation pipeline + FastAPI endpoints.
Final version for clean Supabase PostgreSQL schema.

Table naming after cleanup:
  lowercase:   categories, faculties, users
  PascalCase:  Complaints, Appeals, AiRecommendations

CHANGES IN THIS VERSION
------------------------
1. FIXED: fetch_complaints() previously always pulled the 200 most
   recent complaints SYSTEM-WIDE (LIMIT 200, no faculty filter), and
   run_recommendation_pipeline() filtered faculty AFTER that truncation.
   That meant a faculty whose complaints weren't among the globally
   most-recent 200 could get zero or badly incomplete recommendations,
   even with plenty of their own data -- the isolation feature only
   really worked for whichever faculty happened to be most active.

   fetch_complaints() now takes an optional faculty_id parameter and
   filters at the SQL level (joining through categories.faculty_id)
   BEFORE the LIMIT is applied, so each faculty gets its own most-recent
   200 complaints rather than competing for a shared global slice.

   Backward compatible: faculty_id defaults to None (no filter), so
   dss_routes.py and assistant/services/analytics.py -- which still call
   fetch_complaints(db) with no faculty argument -- are unaffected. Note
   that means those two callers are STILL unscoped by faculty; that is a
   separate, bigger piece of work (touches caching, the voice assistant
   snapshot, and DSS endpoints) that hasn't been done yet.

2. FIXED: update_status() (PATCH /api/manager/recommendations/{rec_id})
   previously had no ownership check at all -- any authenticated manager
   could update ANY recommendation by id, including ones belonging to a
   different faculty (IDOR). It now loads the current user's faculty_id
   and rejects the update with 403 if the recommendation belongs to a
   different faculty.

   ASSUMPTION (please confirm/adjust): admin and super_admin roles are
   exempt from this faculty check and may update any recommendation,
   since they're presumably cross-faculty roles. Managers are strictly
   scoped to their own faculty_id. If admins should ALSO be
   faculty-scoped, remove the role exemption below.
"""

import os
import json
import logging
from datetime import datetime, timedelta
from typing import Optional

import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from auth import authenticate_recommendation_user
from groq import Groq
from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session
from dotenv import load_dotenv

from config import GROQ_MODEL
from database import get_db
from models import AiRecommendation, Category, Faculty, User
from translation import translate_to_english
from dss_analytics import (
    apply_analytical_root_cause,
    build_category_insights,
    format_rca_for_prompt,
)

load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
CACHE_HOURS  = int(os.getenv("RECOMMENDATION_CACHE_HOURS", "24"))

# Tunable analysis parameters. Previously hardcoded (180 days, LIMIT 200,
# minimum 5 complaints per category). Now env-configurable so these can be
# adjusted as the dataset grows or as faculty-level volume becomes clearer,
# without a code change.
#
# ANALYSIS_WINDOW_DAYS: how far back complaints are considered "recent"
#   for risk/trend analysis. This is a business decision (how current does
#   data need to be to matter), not something auto-tuned from data volume.
#
# COMPLAINT_FETCH_LIMIT: max rows fetched per query. Raised from 200 to a
#   default of 500 now that faculty filtering happens at the SQL level
#   (before this limit is applied) rather than truncating a shared global
#   pool. fetch_complaints() logs a warning if a query returns exactly
#   this many rows, since that's a signal the true count may be higher and
#   silently truncated -- watch for that warning and raise the limit if
#   you see it for a real faculty.
#
# MIN_COMPLAINTS_THRESHOLD: minimum complaints a category needs (in the
#   analysis window) before compute_statistics() considers it statistically
#   significant enough to analyze. Lower this if faculty-scoped isolation
#   is causing legitimate categories to fall under the bar; raising it
#   makes that problem worse, not better -- see compute_statistics()
#   docstring.
ANALYSIS_WINDOW_DAYS      = int(os.getenv("ANALYSIS_WINDOW_DAYS", "180"))
COMPLAINT_FETCH_LIMIT     = int(os.getenv("COMPLAINT_FETCH_LIMIT", "500"))
MIN_COMPLAINTS_THRESHOLD  = int(os.getenv("MIN_COMPLAINTS_THRESHOLD", "5"))

logger = logging.getLogger(__name__)
router = APIRouter()

# Roles exempt from per-faculty ownership checks (see update_status).
# See ASSUMPTION note in the module docstring above.
CROSS_FACULTY_ROLES = {"admin"}


# ─────────────────────────────────────────────
# Pydantic schemas
# ─────────────────────────────────────────────

class RecommendationOut(BaseModel):
    id:               int
    category_id:      int
    category_name:    Optional[str] = None
    pattern_detected: Optional[str]
    recommendation:   Optional[str]
    root_cause:       Optional[str]
    urgency:          Optional[str]
    estimated_impact: Optional[str]
    location:         Optional[str]
    complaint_count:  Optional[int]
    avg_resolution_h: Optional[int]
    appeal_rate_pct:  Optional[int]
    top_keywords:     Optional[str]
    status:           Optional[str]
    generated_at:     Optional[datetime]
    createdAt:        Optional[datetime]

    class Config:
        from_attributes = True


class StatusUpdate(BaseModel):
    status: str  # "implemented" or "ignored"


# ─────────────────────────────────────────────
# Step 1: Fetch complaints
# ─────────────────────────────────────────────

# Base query, faculty filter is appended conditionally in fetch_complaints().
# window_days and fetch_limit are bind parameters (see ANALYSIS_WINDOW_DAYS
# and COMPLAINT_FETCH_LIMIT above) instead of hardcoded literals, so both
# can be tuned via env vars without touching this query.
_FETCH_SQL_BASE = """
    SELECT
        c.id,
        c.problem,
        c.ai_summary,
        c.priority,
        c.status,
        c."createdAt",
        c.resolved_at,
        c.location,
        cat.id   AS category_id,
        cat.name AS category_name,
        cat.sla_hours AS sla_hours,
        (SELECT COUNT(*) FROM "Appeals" a WHERE a.complaint_id = c.id) AS has_appeal
    FROM "Complaints" c
    JOIN categories cat ON c.category_id = cat.id
    WHERE c."createdAt" >= NOW() - make_interval(days => :window_days)
    {faculty_clause}
    ORDER BY c."createdAt" DESC
    LIMIT :fetch_limit
"""

FETCH_SQL = text(_FETCH_SQL_BASE.format(faculty_clause=""))
FETCH_SQL_BY_FACULTY = text(_FETCH_SQL_BASE.format(faculty_clause="AND cat.faculty_id = :faculty_id"))


def fetch_complaints(
    db: Session,
    faculty_id: Optional[int] = None,
    window_days: int = ANALYSIS_WINDOW_DAYS,
    fetch_limit: int = COMPLAINT_FETCH_LIMIT,
) -> pd.DataFrame:
    """Fetch the most recent complaints within window_days (default from
    ANALYSIS_WINDOW_DAYS env var), capped at fetch_limit rows (default from
    COMPLAINT_FETCH_LIMIT env var).

    If faculty_id is given, filtering happens at the SQL level (via
    categories.faculty_id) BEFORE the LIMIT is applied, so each faculty
    gets its own most-recent rows rather than competing for a shared
    global slice. If faculty_id is None, behavior is unscoped/global --
    this is what dss_routes.py and assistant/services/analytics.py use
    for managers/admins with no single faculty.

    Logs a warning when the result hits fetch_limit exactly, since that's
    a signal the true count may be higher and got silently truncated --
    if you see this warning for a real faculty, raise
    COMPLAINT_FETCH_LIMIT.
    """
    params = {"window_days": window_days, "fetch_limit": fetch_limit}
    if faculty_id is not None:
        params["faculty_id"] = faculty_id
        result = db.execute(FETCH_SQL_BY_FACULTY, params)
    else:
        result = db.execute(FETCH_SQL, params)
    rows   = result.fetchall()
    cols   = list(result.keys())
    df     = pd.DataFrame(rows, columns=cols)

    if len(df) >= fetch_limit:
        logger.warning(
            "fetch_complaints hit fetch_limit=%d (faculty_id=%s, window_days=%d) -- "
            "results may be silently truncated. Consider raising COMPLAINT_FETCH_LIMIT.",
            fetch_limit, faculty_id, window_days,
        )

    if df.empty:
        return df

    # Translate Arabic to English before any analysis
    df["problem"] = translate_to_english(df["problem"].tolist())
    if "ai_summary" in df.columns and df["ai_summary"].notna().any():
        df["ai_summary"] = translate_to_english(df["ai_summary"].fillna("").tolist())

    # Derived columns
    df["resolved_at"] = pd.to_datetime(df["resolved_at"], errors="coerce", utc=True)
    df["createdAt"]   = pd.to_datetime(df["createdAt"],   errors="coerce", utc=True)

    df["resolution_hours"] = (
        (df["resolved_at"] - df["createdAt"])
        .dt.total_seconds() / 3600
    ).fillna(0).clip(lower=0)

    df["has_appeal"]       = df["has_appeal"].astype(int)
    df["is_high_priority"] = (pd.to_numeric(df["priority"], errors="coerce").fillna(0) >= 4).astype(int)
    df["day_of_week"]      = df["createdAt"].dt.day_name()
    df["month"]            = df["createdAt"].dt.month_name()

    return df


# ─────────────────────────────────────────────
# Step 2: Statistical analysis
# ─────────────────────────────────────────────

def compute_statistics(df: pd.DataFrame, min_complaints: int = MIN_COMPLAINTS_THRESHOLD) -> pd.DataFrame:
    """Aggregate per-category statistics.

    min_complaints: categories with fewer complaints than this in the
    analysis window are dropped as not statistically significant (default
    from MIN_COMPLAINTS_THRESHOLD env var). Lowering this surfaces more
    categories per faculty at the cost of confidence per finding; raising
    it does the opposite and, with faculty-scoped data, will drop MORE
    categories, not fewer -- see the constant's docstring near the top of
    this file before changing the default.
    """
    def safe_mode(series):
        m = series.mode()
        return m.iloc[0] if not m.empty else "N/A"

    stats = (
        df.groupby(["category_id", "category_name"])
        .agg(
            complaint_count    = ("id",                "count"),
            avg_res_hours      = ("resolution_hours",  "mean"),
            appeal_rate        = ("has_appeal",        "mean"),
            high_priority_rate = ("is_high_priority",  "mean"),
            peak_day           = ("day_of_week",       safe_mode),
            peak_month         = ("month",             safe_mode),
            top_location       = ("location",          safe_mode),
            sla_hours          = ("sla_hours",          "first"),
        )
        .reset_index()
    )

    stats = stats[stats["complaint_count"] >= min_complaints].copy()

    stats["avg_res_hours"]     = stats["avg_res_hours"].fillna(0).round(1)
    stats["appeal_rate_pct"]   = (stats["appeal_rate"].fillna(0)        * 100).round(1)
    stats["high_priority_pct"] = (stats["high_priority_rate"].fillna(0) * 100).round(1)

    # Category.sla_hours is nullable -- keep it as plain None (not NaN/pd.NA)
    # so downstream `.get("sla_hours")` / truthiness checks behave normally
    # instead of raising on the ambiguous pd.NA boolean value.
    stats["sla_hours"] = stats["sla_hours"].apply(lambda v: int(v) if pd.notna(v) else None)

    return stats


# ─────────────────────────────────────────────
# Step 3: TF-IDF keyword extraction
# ─────────────────────────────────────────────

def extract_keywords(texts: list, top_n: int = 8) -> list:
    clean = [str(t).strip() for t in texts if t and str(t).strip()]
    if len(clean) < 2:
        return []
    try:
        vectorizer   = TfidfVectorizer(
            stop_words="english",
            max_features=100,
            ngram_range=(1, 2),
            min_df=1,
        )
        tfidf_matrix = vectorizer.fit_transform(clean)
        scores       = tfidf_matrix.mean(axis=0).A1
        terms        = vectorizer.get_feature_names_out()
        top_indices  = scores.argsort()[-top_n * 2:][::-1]

        seen_words     = set()
        final_keywords = []
        for i in top_indices:
            term       = terms[i]
            term_words = set(term.split())
            if term_words.issubset(seen_words):
                continue
            final_keywords.append(term)
            seen_words.update(term_words)
            if len(final_keywords) == top_n:
                break

        return final_keywords

    except Exception as exc:
        logger.warning("TF-IDF failed: %s", exc)
        return []


def get_sample_texts(group_df: pd.DataFrame, n: int = 5) -> list:
    col = "ai_summary" if group_df["ai_summary"].notna().any() else "problem"
    return group_df[col].dropna().head(n).tolist()


# ─────────────────────────────────────────────
# Step 4: Groq LLM call
# ─────────────────────────────────────────────

SYSTEM_PROMPT = (
    "You are a Decision Support analyst for a university student complaints system. "
    "An analytical engine has already computed the facts — your role is to explain findings "
    "and produce professional, actionable recommendations. Do NOT invent data or contradict "
    "the provided analytical findings. "
    "Always respond with ONLY valid JSON — no markdown, no explanation, no preamble."
)

RECOMMENDATION_TEMPLATE = """
You are a Decision Support analyst for a university student complaints system.
An analytical engine has already processed the complaint data below.
Your job is to EXPLAIN the findings and write ONE clear, actionable recommendation.

IMPORTANT: Do NOT invent facts. Base your analysis ONLY on the data provided below.
If a data-confirmed root cause is listed, use it — do not substitute your own.
Focus on recommending concrete management actions.

=== STATISTICAL SUMMARY ===
Category:              {category_name}
Location:              {location}
Total complaints:      {complaint_count} (last 180 days)
Avg resolution time:   {avg_res_hours} hours
Appeal rate:           {appeal_rate_pct}%
High-priority rate:    {high_priority_pct}%
Peak complaint day:    {peak_day}
Peak complaint month:  {peak_month}

{analytical_findings}

=== RECURRING THEMES (TF-IDF keywords) ===
{keywords}

=== REPRESENTATIVE COMPLAINTS ===
{sample_texts}

=== INSTRUCTIONS ===
- pattern_detected: one sentence summarizing the detected complaint pattern from the data above
- root_cause: use the data-confirmed root cause if provided; otherwise state the most likely reason based ONLY on the analytical findings
- recommendation: one specific, actionable step management should take (be concrete, not generic)
- urgency: use the risk level and metrics — high if risk is High, appeal_rate > 20%, or high_priority_rate > 40%
- estimated_impact: one sentence on the expected outcome if the recommendation is followed

Respond ONLY with this JSON, no extra text:
{{
  "pattern_detected": "...",
  "root_cause": "...",
  "recommendation": "...",
  "urgency": "high or medium or low",
  "estimated_impact": "..."
}}
"""


def call_groq(prompt: str) -> dict:
    client   = Groq(api_key=GROQ_API_KEY)
    response = client.chat.completions.create(
        model=GROQ_MODEL,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user",   "content": prompt},
        ],
        temperature=0.3,
        max_tokens=512,
    )
    raw = response.choices[0].message.content.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    return json.loads(raw.strip())


# ─────────────────────────────────────────────
# Step 5: Cache check & save
# ─────────────────────────────────────────────

def get_cached(db: Session, category_id: int, faculty_id: Optional[int] = None) -> Optional[AiRecommendation]:
    cutoff = datetime.utcnow() - timedelta(hours=CACHE_HOURS)
    query = (
        db.query(AiRecommendation)
        .filter(
            AiRecommendation.category_id == category_id,
            AiRecommendation.generated_at >= cutoff,
        )
    )
    # Filter by faculty if provided
    if faculty_id is not None:
        query = query.filter(AiRecommendation.faculty_id == faculty_id)

    return query.order_by(AiRecommendation.generated_at.desc()).first()


def save_recommendation(db, category_id, faculty_id, location, stats, groq_result, keywords):
    now = datetime.utcnow()
    rec = AiRecommendation(
        category_id      = category_id,
        faculty_id       = faculty_id,  # NEW: store faculty for data isolation
        location         = location,
        pattern_detected = groq_result.get("pattern_detected", ""),
        recommendation   = groq_result.get("recommendation", ""),
        root_cause       = groq_result.get("root_cause"),
        urgency          = groq_result.get("urgency", "medium"),
        estimated_impact = groq_result.get("estimated_impact"),
        complaint_count  = int(stats.get("complaint_count") or 0),
        avg_resolution_h = int(stats.get("avg_res_hours")   or 0),
        appeal_rate_pct  = int(stats.get("appeal_rate_pct") or 0),
        top_keywords     = ", ".join(keywords),
        status           = "pending",
        generated_at     = now,
        createdAt        = now,
        updatedAt        = now,
    )
    db.add(rec)
    db.commit()
    db.refresh(rec)
    return rec


# ─────────────────────────────────────────────
# Main pipeline
# ─────────────────────────────────────────────

def run_recommendation_pipeline(db: Session, faculty_id: int) -> list:
    logger.info("Starting recommendation pipeline for faculty_id=%s...", faculty_id)

    # FIXED: faculty filter now applied at the SQL level (before LIMIT 200),
    # instead of fetching the global top-200 and filtering afterward.
    df = fetch_complaints(db, faculty_id=faculty_id)
    if df.empty:
        logger.warning("No complaints found for faculty_id=%s in the last 180 days.", faculty_id)
        return []

    stats_df = compute_statistics(df)
    if stats_df.empty:
        logger.warning("No groups with 5+ complaints found for faculty_id=%s.", faculty_id)
        return []

    # DSS analytical layer — root cause analysis & risk scoring (data-driven, pre-LLM)
    keywords_by_category: dict[int, list] = {}
    for _, row in stats_df.iterrows():
        cat_id = int(row["category_id"])
        mask = df["category_id"] == cat_id
        keywords_by_category[cat_id] = extract_keywords(df[mask]["problem"].tolist())

    category_insights = build_category_insights(df, stats_df, keywords_by_category)

    results = []

    for _, row in stats_df.iterrows():
        cat_id   = int(row["category_id"])
        location = str(row["top_location"]) if row["top_location"] else "Various"

        # Cache check with faculty filtering
        cached = get_cached(db, cat_id, faculty_id)
        if cached:
            logger.info("Cache hit: category=%s faculty=%s", cat_id, faculty_id)
            results.append(cached)
            continue

        # Get all complaints for this category
        mask         = df["category_id"] == cat_id
        group_df     = df[mask]
        keywords     = keywords_by_category.get(cat_id) or extract_keywords(group_df["problem"].tolist())
        sample_texts = get_sample_texts(group_df)

        # DSS insights for this category
        insight = category_insights.get(cat_id, {})
        rca     = insight.get("root_cause_analysis", {})
        risk    = insight.get("risk", {})
        stats   = insight.get("stats", row.to_dict())

        analytical_findings = format_rca_for_prompt(rca, risk, stats)

        # Build prompt with analytical findings
        prompt = RECOMMENDATION_TEMPLATE.format(
            category_name     = row["category_name"],
            location          = f"Most reported at: {location}",
            complaint_count   = int(row["complaint_count"]),
            avg_res_hours     = row["avg_res_hours"],
            appeal_rate_pct   = row["appeal_rate_pct"],
            high_priority_pct = row["high_priority_pct"],
            peak_day          = row["peak_day"],
            peak_month        = row["peak_month"],
            analytical_findings = analytical_findings,
            keywords          = ", ".join(keywords) if keywords else "N/A",
            sample_texts      = "\n".join(f"- {t}" for t in sample_texts) if sample_texts else "N/A",
        )

        # Call Groq — LLM explains findings and recommends; analytics supply the facts
        try:
            groq_result = call_groq(prompt)
            groq_result = apply_analytical_root_cause(groq_result, rca)
            logger.info("Groq responded for category=%s (risk=%s)", cat_id, risk.get("risk_level"))
        except Exception as exc:
            logger.error("Groq failed for cat=%s: %s", cat_id, exc)
            continue

        # Save recommendation with user's faculty_id
        rec = save_recommendation(db, cat_id, faculty_id, location, row.to_dict(), groq_result, keywords)
        results.append(rec)

    logger.info("Pipeline complete. %d recommendations produced for faculty=%s.", len(results), faculty_id)
    return results


# ─────────────────────────────────────────────
# FastAPI Endpoints
# ─────────────────────────────────────────────

@router.post("/api/chat/recommendations", response_model=list[RecommendationOut])
def generate_recommendations(
    db: Session = Depends(get_db),
    authorization: Optional[str] = Header(default=None),
):
    # Get user's faculty_id for data isolation
    current_user = authenticate_recommendation_user(db=db, authorization=authorization)
    user = db.query(User).filter(User.id == current_user.id).first()

    if not user or not user.faculty_id:
        raise HTTPException(
            status_code=403,
            detail="User must be assigned to a faculty to generate recommendations."
        )

    try:
        return run_recommendation_pipeline(db, user.faculty_id)
    except Exception as exc:
        logger.exception("Pipeline error")
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/api/manager/recommendations", response_model=list[RecommendationOut])
def list_recommendations(
    status:      Optional[str] = None,
    category_id: Optional[int] = None,
    db: Session = Depends(get_db),
    authorization: Optional[str] = Header(default=None),
):
    # Authenticate and get user for faculty filtering
    current_user = authenticate_recommendation_user(db=db, authorization=authorization)

    # Get user's faculty_id for data isolation
    user = db.query(User).filter(User.id == current_user.id).first()

    query = db.query(AiRecommendation)

    # Filter by faculty if user has one (data isolation)
    if user and user.faculty_id:
        query = query.filter(AiRecommendation.faculty_id == user.faculty_id)

    if status:
        query = query.filter(AiRecommendation.status == status)
    if category_id:
        query = query.filter(AiRecommendation.category_id == category_id)

    return query.order_by(AiRecommendation.generated_at.desc()).all()


@router.patch("/api/manager/recommendations/{rec_id}", response_model=RecommendationOut)
def update_status(
    rec_id: int,
    body: StatusUpdate,
    db: Session = Depends(get_db),
    authorization: Optional[str] = Header(default=None),
):
    current_user = authenticate_recommendation_user(db=db, authorization=authorization)
    allowed = {"implemented", "ignored"}
    if body.status not in allowed:
        raise HTTPException(status_code=400, detail=f"status must be one of: {allowed}")

    rec = db.query(AiRecommendation).filter(AiRecommendation.id == rec_id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="Recommendation not found")

    # FIXED (IDOR): previously any authenticated manager could update ANY
    # recommendation regardless of faculty. Now: managers may only update
    # recommendations belonging to their own faculty. admin/super_admin are
    # exempt (see CROSS_FACULTY_ROLES docstring note -- confirm this is the
    # intended policy).
    if current_user.role not in CROSS_FACULTY_ROLES:
        user = db.query(User).filter(User.id == current_user.id).first()
        user_faculty_id = user.faculty_id if user else None

        if not user_faculty_id:
            raise HTTPException(
                status_code=403,
                detail="User must be assigned to a faculty to update recommendations.",
            )
        if rec.faculty_id != user_faculty_id:
            raise HTTPException(
                status_code=403,
                detail="You do not have permission to update recommendations for another faculty.",
            )

    rec.status    = body.status
    rec.updatedAt = datetime.utcnow()
    db.commit()
    db.refresh(rec)
    return rec