"""
dss_analytics.py
================
Data-driven Decision Support analytics engine for the complaint recommendation
pipeline.

Architecture
------------
The module is organized into composable analytical engines:

    ┌─────────────────────────────────────────────┐
    │  ConfigEngine        — loads risk_config.json│
    │  RiskEngine          — Goals 1, 2            │
    │  RootCauseEngine     — Goals 3, 4            │
    │  LocationEngine      — Goal 7                │
    │  TemporalEngine      — Goal 8                │
    │  TrendEngine         — Goal 5                │
    │  ResolutionEngine    — Goal 6                │
    │  PredictionEngine    — Goal 10               │
    │  DecisionPriority    — User Request #10      │
    │  AlertEngine         — Goal 11               │
    │  DashboardEngine     — Goals 9, 12           │
    │  ExecutiveSummary    — Goal 13               │
    │  ExplainabilityAPI   — Goal 14               │
    └─────────────────────────────────────────────┘

Pipeline contract
-----------------
    Complaint Data → Statistical Analysis → Risk Analysis → Root Cause Detection
    → Decision Support Analytics → LLM (explains findings and writes recommendations)

The AI must never replace analytical findings.

All root-cause detection, risk scoring, and alert generation is computed from
complaint data — the LLM only explains and recommends based on these findings.

Backward Compatibility (Goal 15)
---------------------------------
Every public function preserves its original signature and return schema.
New fields are *added* — existing fields are never removed or renamed.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

import pandas as pd

logger = logging.getLogger(__name__)

# ═══════════════════════════════════════════════════════════════════════════════
# Constants — backward-compatible aliases
# ═══════════════════════════════════════════════════════════════════════════════

# Complaints that still contribute to operational risk
UNRESOLVED_STATUSES = {"pending", "in_progress", "appealed"}

# Risk-level labels (unchanged)
RISK_LEVEL_LOW = "Low"
RISK_LEVEL_MEDIUM = "Medium"
RISK_LEVEL_HIGH = "High"

# Legacy threshold aliases — kept for any external code that imports them.
# Internally, the engine now reads from risk_config.json.
LOCATION_DOMINANCE_PCT = 40.0
HIGH_PRIORITY_RATE_PCT = 40.0
APPEAL_RATE_PCT = 20.0
TEMPORAL_DOMINANCE_PCT = 35.0

_CHECKS_PATH = Path(__file__).parent / "checks.json"


# ═══════════════════════════════════════════════════════════════════════════════
# §1  CONFIG ENGINE  (Goal 1 — Configurable Risk Engine)
# ═══════════════════════════════════════════════════════════════════════════════
#
# How it works:
#   risk_config.json is loaded once at module import time and cached in
#   _RISK_CONFIG.  Every engine reads thresholds / weights from this dict.
#
# Why it exists:
#   Eliminates hardcoded magic numbers.  Managers or DevOps can tune the DSS
#   without touching Python code.
#
# Fallback:
#   If the file is missing or malformed the engine starts with safe defaults
#   that mirror the original hardcoded values.
# ═══════════════════════════════════════════════════════════════════════════════

_RISK_CONFIG_PATH = Path(__file__).parent / "risk_config.json"

# ── Default configuration (mirrors original hardcoded values) ──
_DEFAULT_CONFIG: dict = {
    "risk_model": "weighted_linear_v1",
    "weights": {
        "unresolved_ratio": 0.35,
        "high_priority": 0.30,
        "appeal_rate": 0.20,
        "aging": 0.15,
    },
    "thresholds": {
        "high_risk": 67,
        "medium_risk": 34,
        "location_hotspot": 40,
        "appeal_rate": 20,
        "high_priority": 40,
        "backlog": 10,
        "aging_days_max": 30,
        "rapid_risk_increase_pct": 15,
        "rapid_complaint_growth_pct": 30,
        "emerging_hotspot_pct": 25,
        "keyword_spike_multiplier": 2.0,
        "aging_cluster_days": 21,
        "declining_quality_threshold": 50,
    },
    "confidence": {
        "location_dominance": 0.30,
        "keyword_consistency": 0.20,
        "complaint_volume": 0.15,
        "temporal_dominance": 0.15,
        "appeal_consistency": 0.10,
        "priority_clustering": 0.10,
    },
    "confidence_levels": {"high": 75, "medium": 50, "low": 0},
    "resolution_quality": {
        "appeal_rate_weight": 0.40,
        "resolution_time_weight": 0.35,
        "aging_weight": 0.25,
        "sla_hours_benchmark": 48,
    },
    "decision_priority": {
        "risk_score_weight": 0.35,
        "confidence_weight": 0.20,
        "complaint_volume_weight": 0.20,
        "high_priority_weight": 0.15,
        "resolution_quality_weight": 0.10,
        "levels": {"critical": 80, "high": 60, "medium": 40, "low": 0},
    },
    "trend": {
        "increasing_threshold_pct": 10,
        "decreasing_threshold_pct": -10,
    },
    "analytics_version": "2.0",
}


def _deep_merge(base: dict, override: dict) -> dict:
    """Recursively merge *override* into *base*, returning a new dict."""
    merged = dict(base)
    for key, val in override.items():
        if key.startswith("_"):  # skip JSON comments
            continue
        if isinstance(val, dict) and isinstance(merged.get(key), dict):
            merged[key] = _deep_merge(merged[key], val)
        else:
            merged[key] = val
    return merged


def _load_risk_config() -> dict:
    """Load risk_config.json once and merge with defaults.

    Returns
    -------
    dict
        Complete configuration with every key guaranteed to exist.

    Business meaning
    ----------------
    Allows the DSS to be tuned by editing a JSON file rather than Python source,
    enabling non-developer stakeholders to adjust thresholds during operation.
    """
    try:
        if _RISK_CONFIG_PATH.exists():
            with open(_RISK_CONFIG_PATH, encoding="utf-8") as fh:
                user_config = json.load(fh)
            merged = _deep_merge(_DEFAULT_CONFIG, user_config)
            logger.info("Loaded risk_config.json (version=%s)", merged.get("analytics_version"))
            return merged
    except Exception as exc:
        logger.warning("Could not load risk_config.json — using defaults: %s", exc)
    return dict(_DEFAULT_CONFIG)


# Module-level cached config — loaded once at import time.
_RISK_CONFIG: dict = _load_risk_config()


def get_risk_config() -> dict:
    """Public accessor for the cached risk configuration."""
    return _RISK_CONFIG


def _cfg_weights() -> dict:
    return _RISK_CONFIG["weights"]


def _cfg_thresholds() -> dict:
    return _RISK_CONFIG["thresholds"]


def _cfg_confidence() -> dict:
    return _RISK_CONFIG["confidence"]


def _cfg_confidence_levels() -> dict:
    return _RISK_CONFIG["confidence_levels"]


def _cfg_resolution_quality() -> dict:
    return _RISK_CONFIG["resolution_quality"]


def _cfg_decision_priority() -> dict:
    return _RISK_CONFIG["decision_priority"]


def _cfg_trend() -> dict:
    return _RISK_CONFIG["trend"]


def _load_checks_config() -> dict:
    """Load optional per-category threshold overrides from checks.json."""
    try:
        if _CHECKS_PATH.exists():
            with open(_CHECKS_PATH, encoding="utf-8") as fh:
                return json.load(fh)
    except Exception as exc:
        logger.warning("Could not load checks.json: %s", exc)
    return {"enabled": True, "categories": {}}


# ═══════════════════════════════════════════════════════════════════════════════
# §2  ANALYTICS METADATA  (User Request #7)
# ═══════════════════════════════════════════════════════════════════════════════


def build_analytics_metadata() -> dict:
    """Return metadata describing how the analytics were produced.

    How it is calculated
    --------------------
    Static metadata from the loaded configuration plus current timestamp.

    Business meaning
    ----------------
    Provides traceability for every analytics response.  Managers and auditors
    can verify which model version and parameters produced a given analysis.

    Expected range
    --------------
    N/A — informational only.

    Manager interpretation
    ----------------------
    Use ``analytics_version`` to track when configuration changes were deployed.
    """
    return {
        "analytics_version": _RISK_CONFIG.get("analytics_version", "2.0"),
        "generated_at": datetime.utcnow().isoformat(),
        "prediction_window_days": 30,
        "risk_model": _RISK_CONFIG.get("risk_model", "weighted_linear_v1"),
    }


# ═══════════════════════════════════════════════════════════════════════════════
# §3  SHARED HELPERS
# ═══════════════════════════════════════════════════════════════════════════════


def is_unresolved(status: Any) -> bool:
    """Return True when a complaint still contributes to operational risk.

    How it is calculated
    --------------------
    Any status that is *not* ``"resolved"`` (case-insensitive) is unresolved.
    ``None`` and ``NaN`` values are treated as unresolved.

    Business meaning
    ----------------
    Determines the operational exposure of a complaint.

    Expected range
    --------------
    Boolean.

    Manager interpretation
    ----------------------
    An unresolved complaint is an active operational risk that requires attention.
    """
    if status is None or (isinstance(status, float) and pd.isna(status)):
        return True
    return str(status).lower() not in {"resolved"}


def risk_level_from_score(score: float) -> str:
    """Map a 0–100 risk score to Low / Medium / High.

    How it is calculated
    --------------------
    Uses configurable thresholds from ``risk_config.json``:
    - ``>= high_risk``   → High
    - ``>= medium_risk`` → Medium
    - otherwise          → Low

    Business meaning
    ----------------
    Translates a numeric score into an actionable severity label.

    Expected range
    --------------
    One of ``"Low"``, ``"Medium"``, ``"High"``.

    Manager interpretation
    ----------------------
    **High** — immediate management action required.
    **Medium** — monitor closely and plan corrective measures.
    **Low** — operating within acceptable parameters.
    """
    thresholds = _cfg_thresholds()
    if score >= thresholds["high_risk"]:
        return RISK_LEVEL_HIGH
    if score >= thresholds["medium_risk"]:
        return RISK_LEVEL_MEDIUM
    return RISK_LEVEL_LOW


def _confidence_level_from_score(score: float) -> str:
    """Map a 0–100 confidence score to Low / Medium / High.

    How it is calculated
    --------------------
    Uses configurable thresholds:
    - ``>= 75`` → High
    - ``>= 50`` → Medium
    - otherwise → Low

    Business meaning
    ----------------
    Indicates how much analytical evidence supports a root-cause finding.

    Manager interpretation
    ----------------------
    **High** (75–100) — strong multi-factor evidence; act with confidence.
    **Medium** (50–74) — moderate evidence; consider before acting.
    **Low** (0–49) — weak evidence; gather more data before deciding.
    """
    levels = _cfg_confidence_levels()
    if score >= levels["high"]:
        return "High"
    if score >= levels["medium"]:
        return "Medium"
    return "Low"


def _safe_pct(numerator: int, denominator: int) -> float:
    """Safe percentage calculation that avoids division by zero."""
    if denominator <= 0:
        return 0.0
    return round(numerator / denominator * 100, 1)


def _dominant_value(series: pd.Series, min_share_pct: float = 0.0) -> Optional[dict]:
    """Return the mode value and its share when it meets the minimum threshold."""
    clean = series.dropna().astype(str).str.strip()
    clean = clean[clean != ""]
    if clean.empty:
        return None
    counts = clean.value_counts()
    top_value = counts.index[0]
    top_count = int(counts.iloc[0])
    share_pct = _safe_pct(top_count, len(clean))
    if share_pct < min_share_pct:
        return {"value": top_value, "count": top_count, "share_pct": share_pct, "dominant": False}
    return {"value": top_value, "count": top_count, "share_pct": share_pct, "dominant": True}


def _top_n_values(series: pd.Series, n: int = 3) -> list[dict]:
    """Return the top *n* values with counts and share percentages.

    How it is calculated
    --------------------
    Value-counts the series, takes the top *n* entries, computes each entry's
    share as a percentage of the total non-null values.

    Business meaning
    ----------------
    Surfaces the most frequently occurring values (e.g. locations, days).

    Expected range
    --------------
    List of 0–*n* dicts, each with ``value``, ``count``, ``share_pct``.
    """
    clean = series.dropna().astype(str).str.strip()
    clean = clean[clean != ""]
    if clean.empty:
        return []
    counts = clean.value_counts()
    total = len(clean)
    results: list[dict] = []
    for value, count in counts.head(n).items():
        results.append({
            "value": str(value),
            "count": int(count),
            "share_pct": _safe_pct(int(count), total),
        })
    return results


def _clamp(value: float, lo: float = 0.0, hi: float = 100.0) -> float:
    """Clamp a numeric value to [lo, hi]."""
    return max(lo, min(value, hi))


# ═══════════════════════════════════════════════════════════════════════════════
# §4  RISK ENGINE  (Goals 1, 2)
# ═══════════════════════════════════════════════════════════════════════════════


def compute_risk_score(group_df: pd.DataFrame) -> dict:
    """Compute operational risk from unresolved complaints only.

    How it is calculated
    --------------------
    Four weighted factors are combined into a 0–100 composite score:

    1. **Unresolved ratio** — proportion of complaints still open.
       ``normalized = unresolved_count / total_count`` (0–1).
    2. **High-priority rate** — proportion of *unresolved* complaints that are
       high-priority.  ``normalized = mean(is_high_priority)`` among unresolved.
    3. **Appeal rate** — proportion of *all* complaints that have an appeal.
       ``normalized = mean(has_appeal)`` across the entire group.
    4. **Aging factor** — how long unresolved complaints have been open.
       ``normalized = min(avg_age_days / aging_days_max, 1.0)`` where
       ``aging_days_max`` defaults to 30 days.

    ``risk_score = Σ (normalized_i × weight_i × 100)``

    Why it exists
    -------------
    Gives management a single actionable number representing operational
    exposure for a complaint category.

    Business meaning
    ----------------
    A high risk score means many complaints are unresolved, high-priority,
    frequently appealed, and/or aging — requiring immediate intervention.

    Expected range
    --------------
    0.0 – 100.0 (float, rounded to 1 decimal).

    Manager interpretation
    ----------------------
    - **0–33** (Low): category is well-managed.
    - **34–66** (Medium): growing issues — schedule corrective action.
    - **67–100** (High): critical — intervene immediately.

    Returns
    -------
    dict
        Contains ``risk_score``, ``risk_level``, ``risk_breakdown`` (Goal 2),
        and all legacy fields (``unresolved_count``, ``resolved_count``,
        ``unresolved_ratio_pct``, ``high_priority_unresolved_pct``,
        ``avg_unresolved_age_days``).
    """
    weights = _cfg_weights()
    thresholds = _cfg_thresholds()

    total = len(group_df)
    unresolved_df = group_df[group_df["status"].apply(is_unresolved)]

    if total == 0:
        return _empty_risk_result(resolved_count=0)

    unresolved_count = len(unresolved_df)
    resolved_count = total - unresolved_count

    if unresolved_count == 0:
        return _empty_risk_result(resolved_count=resolved_count)

    # ── Raw values (0–1 range, unnormalized ratios) ──
    unresolved_ratio = unresolved_count / total
    high_pri_rate = float(unresolved_df["is_high_priority"].mean())
    appeal_rate = float(group_df["has_appeal"].mean())

    now = pd.Timestamp.now(tz="UTC")
    ages_days = (now - unresolved_df["createdAt"]).dt.total_seconds() / 86400
    avg_age_days = float(ages_days.mean()) if len(ages_days) > 0 else 0.0
    aging_days_max = thresholds.get("aging_days_max", 30)
    age_factor = min(avg_age_days / aging_days_max, 1.0)

    # ── Build risk breakdown (Goal 2) ──
    breakdown = _build_risk_breakdown(
        unresolved_ratio=unresolved_ratio,
        high_pri_rate=high_pri_rate,
        appeal_rate=appeal_rate,
        age_factor=age_factor,
        weights=weights,
    )

    score = round(_clamp(sum(f["contribution"] for f in breakdown.values())), 1)

    return {
        # Legacy fields (Goal 15 — backward compatible)
        "risk_score": score,
        "risk_level": risk_level_from_score(score),
        "unresolved_count": unresolved_count,
        "resolved_count": resolved_count,
        "unresolved_ratio_pct": _safe_pct(unresolved_count, total),
        "high_priority_unresolved_pct": _safe_pct(
            int(unresolved_df["is_high_priority"].sum()), unresolved_count
        ),
        "avg_unresolved_age_days": round(avg_age_days, 1),
        # New: Goal 2 — Explainable risk breakdown
        "risk_breakdown": breakdown,
    }


def _empty_risk_result(resolved_count: int = 0) -> dict:
    """Return a zero-risk result with empty breakdown."""
    return {
        "risk_score": 0.0,
        "risk_level": RISK_LEVEL_LOW,
        "unresolved_count": 0,
        "resolved_count": resolved_count,
        "unresolved_ratio_pct": 0.0,
        "high_priority_unresolved_pct": 0.0,
        "avg_unresolved_age_days": 0.0,
        "risk_breakdown": {
            "unresolved_ratio": {"raw_value": 0.0, "normalized_value": 0.0, "weight": 0.35, "contribution": 0.0},
            "high_priority":    {"raw_value": 0.0, "normalized_value": 0.0, "weight": 0.30, "contribution": 0.0},
            "appeal_rate":      {"raw_value": 0.0, "normalized_value": 0.0, "weight": 0.20, "contribution": 0.0},
            "aging":            {"raw_value": 0.0, "normalized_value": 0.0, "weight": 0.15, "contribution": 0.0},
        },
    }


def _build_risk_breakdown(
    unresolved_ratio: float,
    high_pri_rate: float,
    appeal_rate: float,
    age_factor: float,
    weights: dict,
) -> dict[str, dict]:
    """Build the per-factor risk breakdown (Goal 2 + User Request #5).

    Each factor exposes:
    - ``raw_value`` — the original metric value before normalization.
    - ``normalized_value`` — the metric scaled to 0–1 range.
    - ``weight`` — the factor's weight from risk_config.json.
    - ``contribution`` — ``normalized_value × weight × 100`` (points toward
      the final risk score).

    The sum of all contributions equals the final ``risk_score``.
    """
    factors = {
        "unresolved_ratio": {
            "raw_value": round(unresolved_ratio * 100, 1),  # as percentage
            "normalized_value": round(unresolved_ratio, 4),
            "weight": weights["unresolved_ratio"],
            "contribution": round(unresolved_ratio * weights["unresolved_ratio"] * 100, 2),
        },
        "high_priority": {
            "raw_value": round(high_pri_rate * 100, 1),
            "normalized_value": round(high_pri_rate, 4),
            "weight": weights["high_priority"],
            "contribution": round(high_pri_rate * weights["high_priority"] * 100, 2),
        },
        "appeal_rate": {
            "raw_value": round(appeal_rate * 100, 1),
            "normalized_value": round(appeal_rate, 4),
            "weight": weights["appeal_rate"],
            "contribution": round(appeal_rate * weights["appeal_rate"] * 100, 2),
        },
        "aging": {
            "raw_value": round(age_factor * _cfg_thresholds().get("aging_days_max", 30), 1),
            "normalized_value": round(age_factor, 4),
            "weight": weights["aging"],
            "contribution": round(age_factor * weights["aging"] * 100, 2),
        },
    }
    return factors


# ═══════════════════════════════════════════════════════════════════════════════
# §5  ROOT CAUSE ENGINE  (Goals 3, 4)
# ═══════════════════════════════════════════════════════════════════════════════


def compute_confidence_score(
    group_df: pd.DataFrame,
    keywords: list[str],
    stats_row: Optional[dict] = None,
) -> dict:
    """Compute a root-cause confidence score from measurable analytical evidence.

    How it is calculated
    --------------------
    Six measurable factors are weighted and summed:

    1. **Location dominance** (30%): How concentrated complaints are at one
       location.  ``factor = top_location_share / 100``.
    2. **Keyword consistency** (20%): Whether TF-IDF keywords exist and are
       plentiful.  ``factor = min(keyword_count / 5, 1.0)``.
    3. **Complaint volume** (15%): Statistical significance of the sample.
       ``factor = min(complaint_count / 20, 1.0)``.
    4. **Temporal dominance** (15%): How concentrated complaints are on a
       specific day/month.  ``factor = max(day_share, month_share) / 100``.
    5. **Appeal consistency** (10%): Whether the appeal rate is meaningfully
       above zero.  ``factor = min(appeal_rate_pct / 30, 1.0)``.
    6. **Priority clustering** (10%): How concentrated high-priority
       complaints are.  ``factor = high_priority_pct / 100``.

    ``confidence_score = clamp(Σ (factor_i × weight_i × 100), 0, 100)``

    Why it exists
    -------------
    Replaces the binary confident/not-confident decision with a nuanced score
    that managers can use to gauge how much to trust a root-cause finding.

    Business meaning
    ----------------
    Higher confidence means multiple independent indicators converge on the
    same root cause — the finding is more reliable.

    Expected range
    --------------
    0–100 (integer, rounded).

    Manager interpretation
    ----------------------
    - **75–100 (High)**: strong evidence — act immediately.
    - **50–74 (Medium)**: moderate evidence — investigate further before acting.
    - **0–49 (Low)**: weak evidence — gather more data.

    Returns
    -------
    dict
        ``confidence_score`` (int), ``confidence_level`` (str),
        ``confidence_factors`` (dict of per-factor details).
    """
    cfg = _cfg_confidence()
    stats_row = stats_row or {}
    total = len(group_df)

    # ── Factor 1: Location dominance ──
    loc_info = _dominant_value(group_df["location"])
    loc_share = loc_info["share_pct"] if loc_info else 0.0
    location_factor = min(loc_share / 100.0, 1.0)

    # ── Factor 2: Keyword consistency ──
    keyword_count = len(keywords) if keywords else 0
    keyword_factor = min(keyword_count / 5.0, 1.0)

    # ── Factor 3: Complaint volume ──
    volume_factor = min(total / 20.0, 1.0)

    # ── Factor 4: Temporal dominance ──
    day_info = _dominant_value(group_df["day_of_week"])
    month_info = _dominant_value(group_df["month"])
    day_share = day_info["share_pct"] if day_info else 0.0
    month_share = month_info["share_pct"] if month_info else 0.0
    temporal_factor = min(max(day_share, month_share) / 100.0, 1.0)

    # ── Factor 5: Appeal consistency ──
    appeal_pct = float(stats_row.get("appeal_rate_pct") or 0)
    appeal_factor = min(appeal_pct / 30.0, 1.0)

    # ── Factor 6: Priority clustering ──
    hp_pct = float(stats_row.get("high_priority_pct") or 0)
    priority_factor = min(hp_pct / 100.0, 1.0)

    # ── Weighted sum ──
    raw_score = (
        location_factor * cfg["location_dominance"]
        + keyword_factor * cfg["keyword_consistency"]
        + volume_factor * cfg["complaint_volume"]
        + temporal_factor * cfg["temporal_dominance"]
        + appeal_factor * cfg["appeal_consistency"]
        + priority_factor * cfg["priority_clustering"]
    ) * 100

    score = int(round(_clamp(raw_score)))

    factors = {
        "location_dominance": {
            "raw_value": round(loc_share, 1),
            "normalized": round(location_factor, 3),
            "weight": cfg["location_dominance"],
            "contribution": round(location_factor * cfg["location_dominance"] * 100, 1),
        },
        "keyword_consistency": {
            "raw_value": keyword_count,
            "normalized": round(keyword_factor, 3),
            "weight": cfg["keyword_consistency"],
            "contribution": round(keyword_factor * cfg["keyword_consistency"] * 100, 1),
        },
        "complaint_volume": {
            "raw_value": total,
            "normalized": round(volume_factor, 3),
            "weight": cfg["complaint_volume"],
            "contribution": round(volume_factor * cfg["complaint_volume"] * 100, 1),
        },
        "temporal_dominance": {
            "raw_value": round(max(day_share, month_share), 1),
            "normalized": round(temporal_factor, 3),
            "weight": cfg["temporal_dominance"],
            "contribution": round(temporal_factor * cfg["temporal_dominance"] * 100, 1),
        },
        "appeal_consistency": {
            "raw_value": round(appeal_pct, 1),
            "normalized": round(appeal_factor, 3),
            "weight": cfg["appeal_consistency"],
            "contribution": round(appeal_factor * cfg["appeal_consistency"] * 100, 1),
        },
        "priority_clustering": {
            "raw_value": round(hp_pct, 1),
            "normalized": round(priority_factor, 3),
            "weight": cfg["priority_clustering"],
            "contribution": round(priority_factor * cfg["priority_clustering"] * 100, 1),
        },
    }

    return {
        "confidence_score": score,
        "confidence_level": _confidence_level_from_score(score),
        "confidence_factors": factors,
    }


def _build_root_cause_evidence(
    group_df: pd.DataFrame,
    keywords: list[str],
    stats_row: dict,
) -> list[dict]:
    """Build multi-evidence root cause list (Goal 4).

    How it is calculated
    --------------------
    Tests multiple evidence types and assigns a confidence score to each
    based on how strongly the data supports that particular root cause:

    1. **Location Hotspot** — top location share exceeds the hotspot threshold.
    2. **High Appeal Rate** — appeal rate exceeds the configured threshold.
    3. **Priority Cluster** — high-priority complaint rate exceeds threshold.
    4. **Keyword Pattern** — dominant TF-IDF keywords indicate consistent theme.
    5. **Temporal Pattern** — day/month concentration exceeds threshold.
    6. **Aging Backlog** — average unresolved age is critically high.

    Why it exists
    -------------
    The original implementation returned a single root cause.  Multi-evidence
    root cause lets managers see *all* contributing factors ranked by confidence.

    Business meaning
    ----------------
    Multiple evidence items strengthen the case for intervention.  A single
    evidence item might be a coincidence — three converging items demand action.

    Expected range
    --------------
    List of 0–6 evidence dicts, each with ``type``, ``description``,
    ``confidence`` (0–100).

    Manager interpretation
    ----------------------
    Review all evidence items, not just the highest.  If multiple items score
    above 70, the root cause is well-established.

    Returns
    -------
    list[dict]
        Sorted by confidence descending.
    """
    thresholds = _cfg_thresholds()
    evidence: list[dict] = []
    total = len(group_df)

    unresolved_df = group_df[group_df["status"].apply(is_unresolved)]

    # ── Location Hotspot ──
    loc_info = _dominant_value(group_df["location"])
    if loc_info and loc_info["share_pct"] >= thresholds.get("location_hotspot", 40):
        confidence = int(min(loc_info["share_pct"] * 2, 100))
        evidence.append({
            "type": "Location Hotspot",
            "description": (
                f"{loc_info['share_pct']:.0f}% of complaints originate from "
                f"{loc_info['value']}"
            ),
            "confidence": confidence,
        })
    elif loc_info and loc_info["share_pct"] >= thresholds.get("emerging_hotspot_pct", 25):
        confidence = int(min(loc_info["share_pct"] * 1.5, 80))
        evidence.append({
            "type": "Emerging Location Hotspot",
            "description": (
                f"{loc_info['share_pct']:.0f}% of complaints from "
                f"{loc_info['value']} (approaching hotspot threshold)"
            ),
            "confidence": confidence,
        })

    # ── High Appeal Rate ──
    appeal_pct = float(stats_row.get("appeal_rate_pct") or 0)
    if appeal_pct >= thresholds.get("appeal_rate", 20):
        confidence = int(min(appeal_pct * 2.5, 100))
        evidence.append({
            "type": "High Appeal Rate",
            "description": f"Appeal rate reached {appeal_pct:.0f}%",
            "confidence": confidence,
        })

    # ── Priority Cluster ──
    if not unresolved_df.empty:
        hp_count = int(unresolved_df["is_high_priority"].sum())
        hp_pct = _safe_pct(hp_count, len(unresolved_df))
        if hp_pct >= thresholds.get("high_priority", 40):
            confidence = int(min(hp_pct * 1.5, 100))
            evidence.append({
                "type": "Priority Cluster",
                "description": (
                    f"{hp_pct:.0f}% of unresolved complaints are high priority"
                ),
                "confidence": confidence,
            })

    # ── Keyword Pattern ──
    if len(keywords) >= 3:
        confidence = int(min(len(keywords) * 12, 100))
        evidence.append({
            "type": "Keyword Pattern",
            "description": (
                f"Consistent keyword theme detected: {', '.join(keywords[:5])}"
            ),
            "confidence": confidence,
        })

    # ── Temporal Pattern ──
    day_info = _dominant_value(group_df["day_of_week"])
    month_info = _dominant_value(group_df["month"])
    if day_info and day_info["dominant"]:
        confidence = int(min(day_info["share_pct"] * 2, 100))
        evidence.append({
            "type": "Temporal Pattern",
            "description": (
                f"Peak activity on {day_info['value']} "
                f"({day_info['share_pct']:.0f}% of complaints)"
            ),
            "confidence": confidence,
        })
    elif month_info and month_info["dominant"]:
        confidence = int(min(month_info["share_pct"] * 2, 100))
        evidence.append({
            "type": "Temporal Pattern",
            "description": (
                f"Peak activity in {month_info['value']} "
                f"({month_info['share_pct']:.0f}% of complaints)"
            ),
            "confidence": confidence,
        })

    # ── Aging Backlog ──
    if not unresolved_df.empty:
        now = pd.Timestamp.now(tz="UTC")
        ages = (now - unresolved_df["createdAt"]).dt.total_seconds() / 86400
        avg_age = float(ages.mean())
        aging_threshold = thresholds.get("aging_cluster_days", 21)
        if avg_age >= aging_threshold:
            confidence = int(min(avg_age / aging_threshold * 50, 95))
            evidence.append({
                "type": "Aging Backlog",
                "description": (
                    f"Average unresolved complaint age is {avg_age:.0f} days"
                ),
                "confidence": confidence,
            })

    evidence.sort(key=lambda e: e["confidence"], reverse=True)
    return evidence


def analyze_root_causes(
    group_df: pd.DataFrame,
    keywords: list[str],
    stats_row: Optional[dict] = None,
) -> dict:
    """Data-driven root cause analysis for a single complaint category.

    Returns structured findings the LLM must use rather than invent.

    How it is calculated
    --------------------
    1. Detects location hotspots via ``_dominant_value``.
    2. Detects temporal patterns (peak day/month).
    3. Detects high-priority clusters among unresolved complaints.
    4. Detects elevated appeal rates.
    5. Extracts dominant keywords (from TF-IDF, pre-computed).
    6. Counts open/pending cases.
    7. Builds multi-evidence root cause list (Goal 4).
    8. Computes confidence score (Goal 3).

    Why it exists
    -------------
    Provides the factual foundation that the LLM must use for its
    recommendations. The LLM explains — analytics discovers.

    Business meaning
    ----------------
    Root causes are data-confirmed hypotheses about what's driving complaints
    in a category. The confidence score indicates how reliable the finding is.

    Expected range
    --------------
    ``confidence_score``: 0–100.  ``root_cause_evidence``: list of 0–6 items.

    Manager interpretation
    ----------------------
    Focus on root causes with confidence ≥ 50. If ``confident_root_cause``
    is set, it's the single strongest finding.  ``root_cause_evidence`` shows
    all contributing factors.

    Returns
    -------
    dict
        All legacy fields preserved (``findings``, ``confident_root_cause``,
        ``hotspot``, ``patterns``, ``dominant_keywords``, ``appeal_rate_pct``,
        ``high_priority_pct``).  New fields: ``root_cause_evidence``,
        ``confidence_score``, ``confidence_level``, ``confidence_factors``.
    """
    thresholds = _cfg_thresholds()
    findings: list[str] = []
    confident_root_cause: Optional[str] = None
    stats_row = stats_row or {}

    total = len(group_df)
    unresolved_df = group_df[group_df["status"].apply(is_unresolved)]

    # ── Location hotspot ──
    location_threshold = thresholds.get("location_hotspot", LOCATION_DOMINANCE_PCT)
    location_info = _dominant_value(group_df["location"], min_share_pct=location_threshold)
    hotspot = None
    if location_info:
        hotspot = {
            "location": location_info["value"],
            "count": location_info["count"],
            "share_pct": location_info["share_pct"],
            "is_hotspot": location_info["dominant"],
        }
        if location_info["dominant"]:
            msg = (
                f"Dominant location: {location_info['value']} "
                f"({location_info['share_pct']:.0f}% of complaints)"
            )
            findings.append(msg)
            confident_root_cause = (
                f"Most complaints ({location_info['share_pct']:.0f}%) originate from "
                f"{location_info['value']}, indicating a localized facility or service issue."
            )

    # ── Temporal patterns ──
    temporal_threshold = thresholds.get("location_hotspot", TEMPORAL_DOMINANCE_PCT)
    day_info = _dominant_value(group_df["day_of_week"], min_share_pct=temporal_threshold)
    month_info = _dominant_value(group_df["month"], min_share_pct=temporal_threshold)
    patterns: list[str] = []
    if day_info and day_info["dominant"]:
        patterns.append(f"Peak day: {day_info['value']} ({day_info['share_pct']:.0f}% of complaints)")
    if month_info and month_info["dominant"]:
        patterns.append(f"Peak month: {month_info['value']} ({month_info['share_pct']:.0f}% of complaints)")
    findings.extend(patterns)

    # ── High-priority cluster (unresolved only) ──
    hp_threshold = thresholds.get("high_priority", HIGH_PRIORITY_RATE_PCT)
    if not unresolved_df.empty:
        hp_unresolved = int(unresolved_df["is_high_priority"].sum())
        hp_pct = _safe_pct(hp_unresolved, len(unresolved_df))
        if hp_pct >= hp_threshold:
            msg = f"High-priority unresolved issues: {hp_unresolved} ({hp_pct:.0f}% of open cases)"
            findings.append(msg)
            if confident_root_cause is None:
                confident_root_cause = (
                    f"{hp_pct:.0f}% of unresolved complaints are high-priority, "
                    f"indicating urgent systemic issues requiring immediate attention."
                )

    # ── Appeal pattern ──
    appeal_threshold = thresholds.get("appeal_rate", APPEAL_RATE_PCT)
    appeal_rate_pct = float(stats_row.get("appeal_rate_pct") or 0)
    if appeal_rate_pct >= appeal_threshold:
        findings.append(f"Elevated appeal rate: {appeal_rate_pct:.0f}%")
        if confident_root_cause is None:
            confident_root_cause = (
                f"Appeal rate of {appeal_rate_pct:.0f}% suggests students are dissatisfied "
                f"with initial resolutions."
            )

    # ── Dominant keywords (from TF-IDF, already computed) ──
    if keywords:
        top_kw = keywords[:5]
        findings.append(f"Dominant keywords: {', '.join(top_kw)}")

    # ── Status distribution among unresolved ──
    if not unresolved_df.empty:
        status_dist = unresolved_df["status"].value_counts().to_dict()
        open_pending = status_dist.get("pending", 0) + status_dist.get("in_progress", 0)
        if open_pending > 0:
            findings.append(f"Open cases: {open_pending} pending/in-progress")

    # ── Goal 4: Multi-evidence root cause ──
    root_cause_evidence = _build_root_cause_evidence(group_df, keywords, stats_row)

    # If we didn't set confident_root_cause yet but have evidence, use top
    if confident_root_cause is None and root_cause_evidence:
        confident_root_cause = root_cause_evidence[0]["description"]

    # ── Goal 3: Confidence score ──
    confidence = compute_confidence_score(group_df, keywords, stats_row)

    return {
        # Legacy fields (Goal 15)
        "findings": findings,
        "confident_root_cause": confident_root_cause,
        "hotspot": hotspot,
        "patterns": patterns,
        "dominant_keywords": keywords[:8],
        "appeal_rate_pct": appeal_rate_pct,
        "high_priority_pct": float(stats_row.get("high_priority_pct") or 0),
        # New: Goal 3 — Confidence score
        "confidence_score": confidence["confidence_score"],
        "confidence_level": confidence["confidence_level"],
        "confidence_factors": confidence["confidence_factors"],
        # New: Goal 4 — Multi-evidence root cause
        "root_cause_evidence": root_cause_evidence,
    }


# ═══════════════════════════════════════════════════════════════════════════════
# §6  LOCATION ENGINE  (Goal 7 — Better Location Intelligence)
# ═══════════════════════════════════════════════════════════════════════════════


def compute_location_intelligence(group_df: pd.DataFrame) -> list[dict]:
    """Compute top-3 location intelligence for a complaint category.

    How it is calculated
    --------------------
    1. Extract the top 3 locations by complaint count.
    2. Classify each:
       - **Hotspot**: share ≥ ``location_hotspot`` threshold (default 40%).
       - **Emerging**: share ≥ ``emerging_hotspot_pct`` threshold (default 25%).
       - **Notable**: below emerging threshold but still in top 3.

    Why it exists
    -------------
    The original code returned only the single top location. Managers need to
    see whether risk is concentrated or distributed across locations.

    Business meaning
    ----------------
    A single Hotspot means localized failure; multiple Emerging locations
    indicate systemic issues spreading across the campus.

    Expected range
    --------------
    List of 0–3 dicts with ``location``, ``count``, ``share_pct``,
    ``classification``.

    Manager interpretation
    ----------------------
    - **Hotspot** — send a team to investigate this specific location.
    - **Emerging** — monitor closely; it may become a hotspot next cycle.
    - **Notable** — no immediate action, but include in monthly review.
    """
    thresholds = _cfg_thresholds()
    hotspot_pct = thresholds.get("location_hotspot", 40)
    emerging_pct = thresholds.get("emerging_hotspot_pct", 25)

    top_locs = _top_n_values(group_df["location"], n=3)
    results: list[dict] = []

    for loc in top_locs:
        if loc["share_pct"] >= hotspot_pct:
            classification = "Hotspot"
        elif loc["share_pct"] >= emerging_pct:
            classification = "Emerging"
        else:
            classification = "Notable"

        results.append({
            "location": loc["value"],
            "count": loc["count"],
            "share_pct": loc["share_pct"],
            "classification": classification,
        })

    return results


# ═══════════════════════════════════════════════════════════════════════════════
# §7  TEMPORAL ENGINE  (Goal 8 — Temporal Intelligence)
# ═══════════════════════════════════════════════════════════════════════════════


def compute_temporal_intelligence(group_df: pd.DataFrame) -> dict:
    """Detect statistically meaningful temporal patterns in complaint data.

    How it is calculated
    --------------------
    Analyses the ``createdAt`` timestamps to detect:

    1. **Weekday vs Weekend distribution** — reports the ratio of weekday to
       weekend complaints.  Dominance is flagged when either exceeds 80%.
    2. **Peak day and month** — the day/month with the highest complaint share
       (only reported if share ≥ 35% threshold).
    3. **Monthly trend** — complaint counts per month for trend visualization.
    4. **Weekly trend** — complaint counts per day of week.
    5. **Repeated spikes** — months where complaint count exceeds
       2× the monthly average.

    Why it exists
    -------------
    Temporal patterns reveal scheduling-driven issues (e.g. exam season
    overload, weekend understaffing).

    Business meaning
    ----------------
    If complaints spike on specific days, management can pre-allocate resources.
    Seasonal spikes suggest preventive measures before known busy periods.

    Expected range
    --------------
    Dict with ``weekday_weekend``, ``peak_day``, ``peak_month``,
    ``monthly_trend``, ``weekly_trend``, ``repeated_spikes``.

    Manager interpretation
    ----------------------
    - **Weekend dominance** — consider extending service hours.
    - **Exam-season spike** — deploy additional support staff in advance.
    - **Repeated month spikes** — investigate recurring operational bottlenecks.
    """
    result: dict = {}

    if group_df.empty or "createdAt" not in group_df.columns:
        return result

    dates = group_df["createdAt"].dropna()
    if dates.empty:
        return result

    total = len(dates)

    # ── Weekday vs Weekend ──
    weekday_mask = dates.dt.dayofweek < 5
    weekday_count = int(weekday_mask.sum())
    weekend_count = total - weekday_count
    weekday_pct = _safe_pct(weekday_count, total)
    weekend_pct = _safe_pct(weekend_count, total)

    dominance = None
    if weekday_pct >= 80:
        dominance = "Weekday dominant"
    elif weekend_pct >= 50:
        dominance = "Weekend heavy"

    result["weekday_weekend"] = {
        "weekday_count": weekday_count,
        "weekend_count": weekend_count,
        "weekday_pct": weekday_pct,
        "weekend_pct": weekend_pct,
        "dominance": dominance,
    }

    # ── Peak day ──
    day_info = _dominant_value(group_df["day_of_week"], min_share_pct=0)
    if day_info:
        result["peak_day"] = {
            "day": day_info["value"],
            "count": day_info["count"],
            "share_pct": day_info["share_pct"],
            "is_significant": day_info["share_pct"] >= 35,
        }

    # ── Peak month ──
    month_info = _dominant_value(group_df["month"], min_share_pct=0)
    if month_info:
        result["peak_month"] = {
            "month": month_info["value"],
            "count": month_info["count"],
            "share_pct": month_info["share_pct"],
            "is_significant": month_info["share_pct"] >= 35,
        }

    # ── Monthly trend ──
    monthly = dates.dt.to_period("M").value_counts().sort_index()
    monthly_trend: list[dict] = []
    for period, count in monthly.items():
        monthly_trend.append({"month": str(period), "count": int(count)})
    result["monthly_trend"] = monthly_trend

    # ── Weekly trend ──
    day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    weekly_counts = dates.dt.day_name().value_counts()
    weekly_trend: list[dict] = []
    for day in day_names:
        weekly_trend.append({"day": day, "count": int(weekly_counts.get(day, 0))})
    result["weekly_trend"] = weekly_trend

    # ── Repeated spikes ──
    if len(monthly) >= 2:
        avg_monthly = float(monthly.mean())
        spikes: list[dict] = []
        for period, count in monthly.items():
            if count >= avg_monthly * 2 and count >= 3:
                spikes.append({
                    "month": str(period),
                    "count": int(count),
                    "average": round(avg_monthly, 1),
                    "multiplier": round(count / avg_monthly, 1),
                })
        if spikes:
            result["repeated_spikes"] = spikes

    return result


# ═══════════════════════════════════════════════════════════════════════════════
# §8  TREND ENGINE  (Goal 5 — Historical Trend Analytics)
# ═══════════════════════════════════════════════════════════════════════════════


def compute_trend(group_df: pd.DataFrame, risk_data: dict) -> dict:
    """Compare last-30-day vs previous-30-day windows for trend detection.

    How it is calculated
    --------------------
    Splits complaint data into two 30-day windows (last 30 days vs. the 30 days
    before that).  Compares:

    - **Complaint count** — raw count difference.
    - **Risk score** — re-computes risk for each window.
    - **Appeal rate** — appeal rate in each window.
    - **Resolution time** — average resolution hours in each window.

    ``change_pct = ((current - previous) / previous) × 100``

    Trend direction is classified as:
    - **Increasing** if change ≥ +10%.
    - **Decreasing** if change ≤ −10%.
    - **Stable** otherwise.

    Why it exists
    -------------
    Point-in-time metrics miss whether things are getting better or worse.
    Trend detection adds a temporal dimension to risk assessment.

    Business meaning
    ----------------
    An increasing trend in risk or complaints signals a deteriorating situation
    that requires escalation, even if the current absolute score is moderate.

    Expected range
    --------------
    ``trend``: one of ``"Increasing"``, ``"Stable"``, ``"Decreasing"``.
    ``change_percentage``: float (can be negative).

    Manager interpretation
    ----------------------
    - **Increasing risk + High risk** → crisis mode, immediate escalation.
    - **Decreasing risk + Medium risk** → corrective actions are working.
    - **Stable + Low risk** → maintain current operations.
    """
    trend_cfg = _cfg_trend()
    inc_threshold = trend_cfg.get("increasing_threshold_pct", 10)
    dec_threshold = trend_cfg.get("decreasing_threshold_pct", -10)

    now = pd.Timestamp.now(tz="UTC")
    cutoff_30 = now - pd.Timedelta(days=30)
    cutoff_60 = now - pd.Timedelta(days=60)

    if "createdAt" not in group_df.columns or group_df.empty:
        return _empty_trend()

    current_window = group_df[group_df["createdAt"] >= cutoff_30]
    previous_window = group_df[
        (group_df["createdAt"] >= cutoff_60) & (group_df["createdAt"] < cutoff_30)
    ]

    current_count = len(current_window)
    previous_count = len(previous_window)

    # ── Complaint count trend ──
    count_change = _compute_change_pct(current_count, previous_count)

    # ── Appeal rate trend ──
    current_appeal = float(current_window["has_appeal"].mean()) * 100 if not current_window.empty else 0.0
    previous_appeal = float(previous_window["has_appeal"].mean()) * 100 if not previous_window.empty else 0.0
    appeal_change = _compute_change_pct(current_appeal, previous_appeal)

    # ── Resolution time trend ──
    current_res = float(current_window["resolution_hours"].mean()) if not current_window.empty else 0.0
    previous_res = float(previous_window["resolution_hours"].mean()) if not previous_window.empty else 0.0
    resolution_change = _compute_change_pct(current_res, previous_res)

    # ── Risk score trend ──
    current_risk = risk_data.get("risk_score", 0)
    # Estimate previous risk from previous window
    if not previous_window.empty and "status" in previous_window.columns:
        prev_risk_data = compute_risk_score(previous_window)
        previous_risk = prev_risk_data["risk_score"]
    else:
        previous_risk = current_risk
    risk_change = _compute_change_pct(current_risk, previous_risk)

    # ── Overall trend direction (based on risk change) ──
    if risk_change >= inc_threshold:
        overall_trend = "Increasing"
    elif risk_change <= dec_threshold:
        overall_trend = "Decreasing"
    else:
        overall_trend = "Stable"

    return {
        "trend": overall_trend,
        "change_percentage": round(risk_change, 1),
        "comparison": {
            "complaint_count": {
                "current": current_count,
                "previous": previous_count,
                "change_pct": round(count_change, 1),
            },
            "risk_score": {
                "current": current_risk,
                "previous": previous_risk,
                "change_pct": round(risk_change, 1),
            },
            "appeal_rate": {
                "current": round(current_appeal, 1),
                "previous": round(previous_appeal, 1),
                "change_pct": round(appeal_change, 1),
            },
            "resolution_time_hours": {
                "current": round(current_res, 1),
                "previous": round(previous_res, 1),
                "change_pct": round(resolution_change, 1),
            },
        },
        "window_days": 30,
    }


def _compute_change_pct(current: float, previous: float) -> float:
    """Calculate percentage change, handling zero-division safely."""
    if previous <= 0:
        return 100.0 if current > 0 else 0.0
    return ((current - previous) / previous) * 100


def _empty_trend() -> dict:
    """Return a neutral trend result when insufficient data exists."""
    return {
        "trend": "Stable",
        "change_percentage": 0.0,
        "comparison": {
            "complaint_count": {"current": 0, "previous": 0, "change_pct": 0.0},
            "risk_score": {"current": 0, "previous": 0, "change_pct": 0.0},
            "appeal_rate": {"current": 0.0, "previous": 0.0, "change_pct": 0.0},
            "resolution_time_hours": {"current": 0.0, "previous": 0.0, "change_pct": 0.0},
        },
        "window_days": 30,
    }


# ═══════════════════════════════════════════════════════════════════════════════
# §9  RESOLUTION ENGINE  (Goal 6 — Resolution Quality Index)
# ═══════════════════════════════════════════════════════════════════════════════


def compute_resolution_quality(
    group_df: pd.DataFrame,
    stats_row: Optional[dict] = None,
) -> dict:
    """Compute a Resolution Quality Index from operational indicators.

    How it is calculated
    --------------------
    Three weighted factors are combined into a 0–100 quality score:

    1. **Appeal rate factor** (40%): Lower appeal rates mean better resolution
       quality. ``factor = max(1 − appeal_rate/50, 0)``.
    2. **Resolution time factor** (35%): Faster resolution is better.
       ``factor = max(1 − avg_hours/sla_benchmark, 0)`` where
       ``sla_benchmark`` defaults to 48 hours.
    3. **Aging factor** (25%): Fewer old unresolved complaints is better.
       ``factor = max(1 − avg_age_days/30, 0)``.

    ``quality_score = Σ (factor_i × weight_i × 100)``

    Why it exists
    -------------
    Appeal rate alone is an incomplete measure of resolution quality.
    This composite index captures speed, satisfaction, and backlog health.

    Business meaning
    ----------------
    A high quality score means complaints are resolved quickly, students
    rarely appeal, and the backlog is not aging.

    Expected range
    --------------
    0–100 (integer).

    Manager interpretation
    ----------------------
    - **85–100 (Excellent)**: exceptional resolution process.
    - **70–84 (Good)**: performing well, minor improvements possible.
    - **50–69 (Fair)**: needs attention — process improvements recommended.
    - **0–49 (Poor)**: critical quality issues — immediate review required.

    Returns
    -------
    dict
        ``quality_score`` (int), ``quality_level`` (str),
        ``quality_factors`` (dict).
    """
    cfg = _cfg_resolution_quality()
    stats_row = stats_row or {}

    appeal_pct = float(stats_row.get("appeal_rate_pct") or 0)
    avg_res_hours = float(stats_row.get("avg_res_hours") or 0)
    sla_benchmark = cfg.get("sla_hours_benchmark", 48)

    # Compute aging from unresolved complaints
    unresolved_df = group_df[group_df["status"].apply(is_unresolved)]
    if not unresolved_df.empty:
        now = pd.Timestamp.now(tz="UTC")
        ages = (now - unresolved_df["createdAt"]).dt.total_seconds() / 86400
        avg_age = float(ages.mean())
    else:
        avg_age = 0.0

    # ── Factor calculations (higher is better) ──
    appeal_factor = max(1.0 - appeal_pct / 50.0, 0.0)
    resolution_factor = max(1.0 - avg_res_hours / max(sla_benchmark, 1), 0.0)
    aging_factor = max(1.0 - avg_age / 30.0, 0.0)

    raw_score = (
        appeal_factor * cfg["appeal_rate_weight"]
        + resolution_factor * cfg["resolution_time_weight"]
        + aging_factor * cfg["aging_weight"]
    ) * 100

    score = int(round(_clamp(raw_score)))

    # ── Quality level ──
    if score >= 85:
        level = "Excellent"
    elif score >= 70:
        level = "Good"
    elif score >= 50:
        level = "Fair"
    else:
        level = "Poor"

    return {
        "quality_score": score,
        "quality_level": level,
        "quality_factors": {
            "appeal_rate": {
                "raw_value": round(appeal_pct, 1),
                "factor": round(appeal_factor, 3),
                "weight": cfg["appeal_rate_weight"],
                "contribution": round(appeal_factor * cfg["appeal_rate_weight"] * 100, 1),
            },
            "resolution_time": {
                "raw_value": round(avg_res_hours, 1),
                "factor": round(resolution_factor, 3),
                "weight": cfg["resolution_time_weight"],
                "contribution": round(resolution_factor * cfg["resolution_time_weight"] * 100, 1),
            },
            "aging_backlog": {
                "raw_value": round(avg_age, 1),
                "factor": round(aging_factor, 3),
                "weight": cfg["aging_weight"],
                "contribution": round(aging_factor * cfg["aging_weight"] * 100, 1),
            },
        },
    }


# ═══════════════════════════════════════════════════════════════════════════════
# §10  PREDICTION ENGINE  (Goal 10 — Prediction Layer)
# ═══════════════════════════════════════════════════════════════════════════════


def compute_prediction(
    group_df: pd.DataFrame,
    current_risk: float,
    trend_data: dict,
) -> dict:
    """Estimate 30-day operational risk if no intervention occurs.

    How it is calculated
    --------------------
    Simple statistical extrapolation (no machine learning):

    1. **Predicted complaint count**: current 30-day count ×
       (1 + change_pct/100).
    2. **Predicted unresolved count**: current unresolved ×
       (1 + change_pct/100), capped at predicted total.
    3. **Predicted risk score**: current risk + (risk change rate × 1 period).
       Clamped to 0–100.

    Prediction confidence is based on how much data was available:
    - ≥ 20 complaints in current window → High confidence.
    - ≥ 10 complaints → Medium confidence.
    - < 10 complaints → Low confidence.

    Why it exists
    -------------
    Management needs to know not just the current state, but where things are
    heading.  Even a simple projection helps prioritize intervention.

    Business meaning
    ----------------
    If predicted risk is significantly higher than current risk, it signals
    a deteriorating situation that will worsen without action.

    Expected range
    --------------
    ``predicted_risk``: 0–100. ``prediction_confidence``: Low / Medium / High.

    Manager interpretation
    ----------------------
    Compare predicted vs current risk:
    - **Large increase** → urgent intervention needed.
    - **Stable** → maintain current strategy.
    - **Decrease** → current measures are effective.

    Returns
    -------
    dict
        ``current_risk``, ``predicted_risk``, ``predicted_complaints``,
        ``predicted_unresolved``, ``trend``, ``prediction_confidence``,
        ``prediction_window_days``.
    """
    comparison = trend_data.get("comparison", {})
    risk_change_pct = comparison.get("risk_score", {}).get("change_pct", 0.0)
    count_change_pct = comparison.get("complaint_count", {}).get("change_pct", 0.0)

    # Current window data
    now = pd.Timestamp.now(tz="UTC")
    cutoff_30 = now - pd.Timedelta(days=30)
    current_window = group_df[group_df["createdAt"] >= cutoff_30] if not group_df.empty else group_df

    current_count = len(current_window)
    current_unresolved = len(
        current_window[current_window["status"].apply(is_unresolved)]
    ) if not current_window.empty else 0

    # ── Predicted values ──
    predicted_count = max(0, int(round(current_count * (1 + count_change_pct / 100))))
    predicted_risk = round(_clamp(current_risk + (risk_change_pct / 100 * current_risk)), 1)
    predicted_unresolved = max(0, int(round(
        current_unresolved * (1 + count_change_pct / 100)
    )))
    predicted_unresolved = min(predicted_unresolved, predicted_count)

    # ── Prediction confidence ──
    if current_count >= 20:
        confidence = "High"
    elif current_count >= 10:
        confidence = "Medium"
    else:
        confidence = "Low"

    return {
        "current_risk": current_risk,
        "predicted_risk": predicted_risk,
        "predicted_complaints": predicted_count,
        "predicted_unresolved": predicted_unresolved,
        "trend": trend_data.get("trend", "Stable"),
        "prediction_confidence": confidence,
        "prediction_window_days": 30,
    }


# ═══════════════════════════════════════════════════════════════════════════════
# §11  DECISION PRIORITY ENGINE  (User Request #10)
# ═══════════════════════════════════════════════════════════════════════════════


def compute_decision_priority(
    risk_score: float,
    confidence_score: float,
    complaint_count: int,
    high_priority_pct: float,
    quality_score: float,
) -> dict:
    """Compute a Decision Priority Score to rank recommendation urgency.

    How it is calculated
    --------------------
    Five weighted factors are combined:

    1. **Risk score** (35%): ``factor = risk_score / 100``.
    2. **Root cause confidence** (20%): ``factor = confidence_score / 100``.
       Higher confidence means the recommendation is more actionable.
    3. **Complaint volume** (20%): ``factor = min(complaint_count / 50, 1.0)``.
    4. **High-priority rate** (15%): ``factor = high_priority_pct / 100``.
    5. **Resolution quality** (10%): ``factor = (100 − quality_score) / 100``.
       *Inverted* — worse quality means higher priority to fix.

    ``priority_score = Σ (factor_i × weight_i × 100)``

    Why it exists
    -------------
    Helps managers decide which recommendation to implement *first*.
    Risk score alone doesn't capture whether a recommendation is actionable
    (confidence) or how many people are affected (volume).

    Business meaning
    ----------------
    The Decision Priority Score turns the DSS from a reporting dashboard
    into a true Decision Support System by ranking actionability.

    Expected range
    --------------
    0–100 (integer).

    Manager interpretation
    ----------------------
    - **80–100 (Critical)**: implement this recommendation immediately.
    - **60–79 (High)**: schedule for this week.
    - **40–59 (Medium)**: plan for the current cycle.
    - **0–39 (Low)**: backlog; address when resources allow.

    Returns
    -------
    dict
        ``score`` (int), ``level`` (str), ``factors`` (dict).
    """
    cfg = _cfg_decision_priority()
    levels = cfg.get("levels", {"critical": 80, "high": 60, "medium": 40, "low": 0})

    risk_factor = risk_score / 100.0
    confidence_factor = confidence_score / 100.0
    volume_factor = min(complaint_count / 50.0, 1.0)
    hp_factor = high_priority_pct / 100.0
    quality_factor = (100 - quality_score) / 100.0  # inverted

    raw_score = (
        risk_factor * cfg["risk_score_weight"]
        + confidence_factor * cfg["confidence_weight"]
        + volume_factor * cfg["complaint_volume_weight"]
        + hp_factor * cfg["high_priority_weight"]
        + quality_factor * cfg["resolution_quality_weight"]
    ) * 100

    score = int(round(_clamp(raw_score)))

    if score >= levels.get("critical", 80):
        level = "Critical"
    elif score >= levels.get("high", 60):
        level = "High"
    elif score >= levels.get("medium", 40):
        level = "Medium"
    else:
        level = "Low"

    return {
        "score": score,
        "level": level,
        "factors": {
            "risk_score": {
                "raw_value": round(risk_score, 1),
                "weight": cfg["risk_score_weight"],
                "contribution": round(risk_factor * cfg["risk_score_weight"] * 100, 1),
            },
            "confidence": {
                "raw_value": round(confidence_score, 1),
                "weight": cfg["confidence_weight"],
                "contribution": round(confidence_factor * cfg["confidence_weight"] * 100, 1),
            },
            "complaint_volume": {
                "raw_value": complaint_count,
                "weight": cfg["complaint_volume_weight"],
                "contribution": round(volume_factor * cfg["complaint_volume_weight"] * 100, 1),
            },
            "high_priority": {
                "raw_value": round(high_priority_pct, 1),
                "weight": cfg["high_priority_weight"],
                "contribution": round(hp_factor * cfg["high_priority_weight"] * 100, 1),
            },
            "resolution_quality": {
                "raw_value": round(quality_score, 1),
                "weight": cfg["resolution_quality_weight"],
                "contribution": round(quality_factor * cfg["resolution_quality_weight"] * 100, 1),
            },
        },
    }


# ═══════════════════════════════════════════════════════════════════════════════
# §12  ALERT ENGINE  (Goal 11 — Smarter Alerts)
# ═══════════════════════════════════════════════════════════════════════════════


def generate_smart_alerts(
    df: pd.DataFrame,
    stats_df: pd.DataFrame,
    category_insights: dict[int, dict],
) -> list[dict]:
    """Generate threshold-based alerts suitable for dashboard display.

    How it is calculated
    --------------------
    Iterates over every analysed category and tests multiple alert conditions.
    Original alerts are preserved; seven new alert types are added.

    Every alert now includes:
    - ``severity`` — high / medium / low.
    - ``message`` — human-readable alert text.
    - ``metric_value`` — the raw metric that triggered the alert.
    - ``reason`` — why this alert was raised.
    - ``recommended_action`` — what management should do.

    Original alert types (preserved):
    1. ``high_risk`` / ``elevated_risk`` — risk score thresholds.
    2. ``high_appeal_rate`` — appeal rate above threshold.
    3. ``high_priority_cluster`` — high-priority complaint concentration.
    4. ``location_hotspot`` — location exceeds hotspot threshold.
    5. ``backlog`` — unresolved count exceeds backlog threshold.

    New alert types (Goal 11):
    6. ``rapid_risk_increase`` — risk increased ≥ 15% in 30 days.
    7. ``rapid_complaint_growth`` — complaint count grew ≥ 30% in 30 days.
    8. ``declining_resolution_quality`` — quality score fell below 50.
    9. ``emerging_hotspot`` — location approaching hotspot threshold.
    10. ``risk_forecast_high`` — predicted risk ≥ High threshold.
    11. ``repeated_keyword_spike`` — not implemented (requires multi-period keywords).
    12. ``aging_complaint_cluster`` — avg age ≥ 21 days.

    Why it exists
    -------------
    Proactive alerting lets managers fix problems before they escalate.

    Business meaning
    ----------------
    Each alert is an actionable signal. The ``recommended_action`` field
    gives managers a concrete next step.

    Expected range
    --------------
    List of 0–N alert dicts, sorted by severity then metric value.

    Manager interpretation
    ----------------------
    Review high-severity alerts first. Each alert's ``recommended_action``
    provides the next step.

    Returns
    -------
    list[dict]
        Sorted by severity (high first) then ``metric_value`` descending.
    """
    thresholds = _cfg_thresholds()
    alerts: list[dict] = []
    checks = _load_checks_config()
    if not checks.get("enabled", True):
        return alerts

    for _, row in stats_df.iterrows():
        cat_id = int(row["category_id"])
        cat_name = str(row["category_name"])
        insight = category_insights.get(cat_id, {})
        risk = insight.get("risk", {})
        rca = insight.get("root_cause_analysis", {})
        trend_data = insight.get("trend", {})
        prediction = insight.get("prediction", {})
        resolution_q = insight.get("resolution_quality", {})
        location_intel = insight.get("location_intelligence", [])

        risk_score = risk.get("risk_score", 0)

        # ── Original alerts (backward compatible) ──
        if risk_score >= thresholds.get("high_risk", 67):
            alerts.append({
                "severity": "high",
                "category_id": cat_id,
                "category_name": cat_name,
                "alert_type": "high_risk",
                "message": f"{cat_name}: operational risk score is {risk_score} (High)",
                "metric_value": risk_score,
                "reason": "Risk score exceeds the high-risk threshold",
                "recommended_action": "Initiate immediate investigation and allocate additional resources",
            })
        elif risk_score >= thresholds.get("medium_risk", 34):
            alerts.append({
                "severity": "medium",
                "category_id": cat_id,
                "category_name": cat_name,
                "alert_type": "elevated_risk",
                "message": f"{cat_name}: operational risk score is {risk_score} (Medium)",
                "metric_value": risk_score,
                "reason": "Risk score is in the elevated range",
                "recommended_action": "Monitor closely and schedule a review meeting",
            })

        appeal_pct = float(row.get("appeal_rate_pct") or 0)
        appeal_threshold = thresholds.get("appeal_rate", 20)
        if appeal_pct >= appeal_threshold:
            alerts.append({
                "severity": "high" if appeal_pct >= 30 else "medium",
                "category_id": cat_id,
                "category_name": cat_name,
                "alert_type": "high_appeal_rate",
                "message": f"{cat_name}: appeal rate is {appeal_pct:.0f}%",
                "metric_value": appeal_pct,
                "reason": f"Appeal rate exceeds the {appeal_threshold}% threshold",
                "recommended_action": "Review resolution quality and retrain staff on complaint handling",
            })

        hp_pct = float(row.get("high_priority_pct") or 0)
        hp_threshold = thresholds.get("high_priority", 40)
        if hp_pct >= hp_threshold:
            alerts.append({
                "severity": "high",
                "category_id": cat_id,
                "category_name": cat_name,
                "alert_type": "high_priority_cluster",
                "message": f"{cat_name}: {hp_pct:.0f}% of complaints are high-priority",
                "metric_value": hp_pct,
                "reason": f"High-priority rate exceeds {hp_threshold}%",
                "recommended_action": "Escalate to senior management and fast-track resolution of high-priority cases",
            })

        hotspot = rca.get("hotspot")
        if hotspot and hotspot.get("is_hotspot"):
            alerts.append({
                "severity": "medium",
                "category_id": cat_id,
                "category_name": cat_name,
                "alert_type": "location_hotspot",
                "message": (
                    f"{cat_name}: {hotspot['share_pct']:.0f}% of complaints from "
                    f"{hotspot['location']}"
                ),
                "metric_value": hotspot["share_pct"],
                "reason": "A single location generates a disproportionate share of complaints",
                "recommended_action": f"Send inspection team to {hotspot['location']} and assess facility conditions",
            })

        backlog_threshold = thresholds.get("backlog", 10)
        unresolved = risk.get("unresolved_count", 0)
        if unresolved >= backlog_threshold:
            alerts.append({
                "severity": "medium",
                "category_id": cat_id,
                "category_name": cat_name,
                "alert_type": "backlog",
                "message": f"{cat_name}: {unresolved} unresolved complaints",
                "metric_value": float(unresolved),
                "reason": f"Unresolved complaint count exceeds {backlog_threshold}",
                "recommended_action": "Assign additional staff to clear the backlog within the current cycle",
            })

        # ── New alerts (Goal 11) ──

        # Rapid Risk Increase
        risk_change = trend_data.get("change_percentage", 0)
        rapid_risk_pct = thresholds.get("rapid_risk_increase_pct", 15)
        if risk_change >= rapid_risk_pct:
            alerts.append({
                "severity": "high",
                "category_id": cat_id,
                "category_name": cat_name,
                "alert_type": "rapid_risk_increase",
                "message": f"{cat_name}: risk increased {risk_change:.0f}% in the last 30 days",
                "metric_value": risk_change,
                "reason": f"Risk score increased more than {rapid_risk_pct}% over the previous period",
                "recommended_action": "Investigate what changed in the last 30 days and deploy corrective measures",
            })

        # Rapid Complaint Growth
        complaint_change = trend_data.get("comparison", {}).get("complaint_count", {}).get("change_pct", 0)
        rapid_growth_pct = thresholds.get("rapid_complaint_growth_pct", 30)
        if complaint_change >= rapid_growth_pct:
            alerts.append({
                "severity": "high",
                "category_id": cat_id,
                "category_name": cat_name,
                "alert_type": "rapid_complaint_growth",
                "message": f"{cat_name}: complaint volume grew {complaint_change:.0f}% in 30 days",
                "metric_value": complaint_change,
                "reason": f"Complaint count increased more than {rapid_growth_pct}% vs previous period",
                "recommended_action": "Identify the source of the surge and allocate emergency resources",
            })

        # Declining Resolution Quality
        q_score = resolution_q.get("quality_score", 100)
        q_threshold = thresholds.get("declining_quality_threshold", 50)
        if q_score < q_threshold:
            alerts.append({
                "severity": "high" if q_score < 30 else "medium",
                "category_id": cat_id,
                "category_name": cat_name,
                "alert_type": "declining_resolution_quality",
                "message": f"{cat_name}: resolution quality score is {q_score} ({resolution_q.get('quality_level', 'Poor')})",
                "metric_value": float(q_score),
                "reason": f"Resolution quality dropped below the {q_threshold} threshold",
                "recommended_action": "Review the resolution process and retrain complaint handlers",
            })

        # Emerging Hotspot
        emerging_threshold = thresholds.get("emerging_hotspot_pct", 25)
        for loc in location_intel:
            if loc.get("classification") == "Emerging":
                alerts.append({
                    "severity": "low",
                    "category_id": cat_id,
                    "category_name": cat_name,
                    "alert_type": "emerging_hotspot",
                    "message": (
                        f"{cat_name}: {loc['location']} is an emerging hotspot "
                        f"({loc['share_pct']:.0f}% of complaints)"
                    ),
                    "metric_value": loc["share_pct"],
                    "reason": f"Location share ({loc['share_pct']:.0f}%) is approaching the hotspot threshold",
                    "recommended_action": f"Proactively monitor {loc['location']} to prevent escalation",
                })

        # Risk Forecast High
        predicted_risk = prediction.get("predicted_risk", 0)
        if predicted_risk >= thresholds.get("high_risk", 67) and risk_score < thresholds.get("high_risk", 67):
            alerts.append({
                "severity": "high",
                "category_id": cat_id,
                "category_name": cat_name,
                "alert_type": "risk_forecast_high",
                "message": f"{cat_name}: predicted risk will reach {predicted_risk} in 30 days",
                "metric_value": predicted_risk,
                "reason": "Statistical projection indicates risk will cross the high-risk threshold",
                "recommended_action": "Implement preventive measures now to avoid reaching critical risk levels",
            })

        # Aging Complaint Cluster
        avg_age = risk.get("avg_unresolved_age_days", 0)
        aging_threshold = thresholds.get("aging_cluster_days", 21)
        if avg_age >= aging_threshold:
            alerts.append({
                "severity": "high" if avg_age >= 30 else "medium",
                "category_id": cat_id,
                "category_name": cat_name,
                "alert_type": "aging_complaint_cluster",
                "message": f"{cat_name}: average unresolved complaint age is {avg_age:.0f} days",
                "metric_value": avg_age,
                "reason": f"Unresolved complaints have been open for more than {aging_threshold} days on average",
                "recommended_action": "Prioritize the oldest complaints and set a deadline for resolution",
            })

    # Sort by severity (high first) then metric value descending
    severity_order = {"high": 0, "medium": 1, "low": 2}
    alerts.sort(key=lambda a: (severity_order.get(a["severity"], 3), -a["metric_value"]))
    return alerts


# ═══════════════════════════════════════════════════════════════════════════════
# §13  EVIDENCE PACKAGE  (Goal 9 — Recommendation Evidence Package)
# ═══════════════════════════════════════════════════════════════════════════════


def build_evidence_package(
    rca: dict,
    risk: dict,
    stats: dict,
    keywords: list[str],
    trend_data: dict,
    confidence: dict,
    prediction: dict,
) -> dict:
    """Bundle all supporting evidence for a recommendation.

    How it is calculated
    --------------------
    Aggregates outputs from all analytical engines into a single evidence dict
    that makes any recommendation fully explainable.

    Why it exists
    -------------
    Recommendations without supporting evidence are not actionable.
    This package gives managers everything they need to justify a decision.

    Business meaning
    ----------------
    The evidence package turns a recommendation from an opinion into a
    data-backed business case.

    Expected range
    --------------
    N/A — composite dict.

    Manager interpretation
    ----------------------
    Use the evidence package to prepare reports, justify budget requests,
    and communicate decisions to stakeholders.
    """
    return {
        "root_cause": rca.get("confident_root_cause"),
        "root_cause_evidence": rca.get("root_cause_evidence", []),
        "confidence_score": confidence.get("confidence_score", 0),
        "confidence_level": confidence.get("confidence_level", "Low"),
        "risk_score": risk.get("risk_score", 0),
        "risk_level": risk.get("risk_level", RISK_LEVEL_LOW),
        "risk_breakdown": risk.get("risk_breakdown", {}),
        "trend": trend_data.get("trend", "Stable"),
        "change_percentage": trend_data.get("change_percentage", 0),
        "prediction": prediction,
        "keywords": keywords[:8] if keywords else [],
        "supporting_metrics": {
            "complaint_count": stats.get("complaint_count", 0),
            "appeal_rate_pct": stats.get("appeal_rate_pct", 0),
            "high_priority_pct": stats.get("high_priority_pct", 0),
            "avg_res_hours": stats.get("avg_res_hours", 0),
            "top_location": stats.get("top_location", "N/A"),
        },
    }


# ═══════════════════════════════════════════════════════════════════════════════
# §14  CATEGORY INSIGHTS BUILDER  (Goals 14, 15 — Explainability API)
# ═══════════════════════════════════════════════════════════════════════════════


def build_category_insights(
    df: pd.DataFrame,
    stats_df: pd.DataFrame,
    keywords_by_category: Optional[dict[int, list[str]]] = None,
) -> dict[int, dict]:
    """Build per-category DSS insight bundle used by the pipeline and APIs.

    keywords_by_category: pre-computed TF-IDF keywords; computed lazily if omitted.

    How it is calculated
    --------------------
    For every category with sufficient data (≥5 complaints), runs all
    analytical engines and assembles a complete insight bundle:

    1. Risk Engine → ``risk``, ``risk_breakdown``
    2. Root Cause Engine → ``root_cause_analysis``, ``confidence``, ``evidence``
    3. Location Engine → ``location_intelligence``
    4. Temporal Engine → ``temporal_intelligence``
    5. Trend Engine → ``trend``
    6. Resolution Engine → ``resolution_quality``
    7. Prediction Engine → ``prediction``
    8. Decision Priority → ``decision_priority``
    9. Evidence Package → ``evidence_package``
    10. Analytics Metadata → ``analytics_metadata``

    Why it exists
    -------------
    Single entry point for all per-category analytics.  Every downstream
    consumer (routes, pipeline, alerts) reads from this dict.

    Business meaning
    ----------------
    The complete analytical profile of a complaint category — everything
    a manager needs to understand, decide, and act.

    Returns
    -------
    dict[int, dict]
        Keyed by ``category_id``.  All legacy fields preserved (Goal 15).
    """
    keywords_by_category = keywords_by_category or {}
    insights: dict[int, dict] = {}

    for _, row in stats_df.iterrows():
        cat_id = int(row["category_id"])
        group_df = df[df["category_id"] == cat_id]
        keywords = keywords_by_category.get(cat_id, [])
        stats_dict = row.to_dict()

        # ── Core engines ──
        risk = compute_risk_score(group_df)
        rca = analyze_root_causes(group_df, keywords, stats_dict)

        # ── Extended engines ──
        location_intel = compute_location_intelligence(group_df)
        temporal_intel = compute_temporal_intelligence(group_df)
        resolution_q = compute_resolution_quality(group_df, stats_dict)

        stats_block = {
            "complaint_count": int(row["complaint_count"]),
            "avg_res_hours": float(row["avg_res_hours"]),
            "appeal_rate_pct": float(row["appeal_rate_pct"]),
            "high_priority_pct": float(row["high_priority_pct"]),
            "peak_day": str(row["peak_day"]),
            "peak_month": str(row["peak_month"]),
            "top_location": str(row["top_location"]),
        }

        # Trend needs risk data
        trend_data = compute_trend(group_df, risk)

        # Prediction needs risk + trend
        prediction = compute_prediction(
            group_df, risk["risk_score"], trend_data
        )

        # Confidence data from rca
        confidence_data = {
            "confidence_score": rca.get("confidence_score", 0),
            "confidence_level": rca.get("confidence_level", "Low"),
        }

        # Decision Priority
        decision_priority = compute_decision_priority(
            risk_score=risk["risk_score"],
            confidence_score=rca.get("confidence_score", 0),
            complaint_count=int(row["complaint_count"]),
            high_priority_pct=float(row["high_priority_pct"]),
            quality_score=resolution_q["quality_score"],
        )

        # Evidence package
        evidence_pkg = build_evidence_package(
            rca=rca,
            risk=risk,
            stats=stats_block,
            keywords=keywords,
            trend_data=trend_data,
            confidence=confidence_data,
            prediction=prediction,
        )

        insights[cat_id] = {
            # Legacy fields (Goal 15 — backward compatible)
            "category_id": cat_id,
            "category_name": str(row["category_name"]),
            "risk": risk,
            "root_cause_analysis": rca,
            "stats": stats_block,
            # New: Goal 7 — Location intelligence
            "location_intelligence": location_intel,
            # New: Goal 8 — Temporal intelligence
            "temporal_intelligence": temporal_intel,
            # New: Goal 5 — Trend analytics
            "trend": trend_data,
            # New: Goal 6 — Resolution quality
            "resolution_quality": resolution_q,
            # New: Goal 10 — Prediction layer
            "prediction": prediction,
            # New: User Request #10 — Decision priority
            "decision_priority": decision_priority,
            # New: Goal 9 — Evidence package
            "evidence_package": evidence_pkg,
            # New: User Request #7 — Analytics metadata
            "analytics_metadata": build_analytics_metadata(),
        }

    return insights


# ═══════════════════════════════════════════════════════════════════════════════
# §15  RISK RANKING
# ═══════════════════════════════════════════════════════════════════════════════


def build_category_risk_ranking(category_insights: dict[int, dict]) -> list[dict]:
    """Rank categories by operational risk score for dashboard charts.

    How it is calculated
    --------------------
    Sorts all categories by ``risk_score`` descending and assigns ranks.

    Why it exists
    -------------
    Gives management a priority-ordered view of which categories need attention.

    Business meaning
    ----------------
    The top-ranked category is the most operationally risky and should be
    addressed first.

    Returns
    -------
    list[dict]
        Sorted by risk score descending, with ``rank`` starting at 1.
    """
    ranking = []
    for cat_id, insight in category_insights.items():
        risk = insight["risk"]
        stats = insight["stats"]
        rca = insight["root_cause_analysis"]
        dp = insight.get("decision_priority", {})
        ranking.append({
            # Legacy fields
            "category_id": cat_id,
            "category_name": insight["category_name"],
            "risk_score": risk["risk_score"],
            "risk_level": risk["risk_level"],
            "unresolved_count": risk["unresolved_count"],
            "complaint_count": stats["complaint_count"],
            "appeal_rate_pct": stats["appeal_rate_pct"],
            "high_priority_pct": stats["high_priority_pct"],
            "dominant_location": stats["top_location"],
            "hotspot_location": (rca.get("hotspot") or {}).get("location"),
            "hotspot_share_pct": (rca.get("hotspot") or {}).get("share_pct"),
            # New fields
            "confidence_score": rca.get("confidence_score", 0),
            "confidence_level": rca.get("confidence_level", "Low"),
            "decision_priority_score": dp.get("score", 0),
            "decision_priority_level": dp.get("level", "Low"),
        })

    ranking.sort(key=lambda x: x["risk_score"], reverse=True)
    for i, item in enumerate(ranking, start=1):
        item["rank"] = i
    return ranking


# ═══════════════════════════════════════════════════════════════════════════════
# §16  DASHBOARD ENGINE  (Goal 12 — Dashboard KPIs)
# ═══════════════════════════════════════════════════════════════════════════════


def build_dashboard_metrics(
    df: pd.DataFrame,
    stats_df: pd.DataFrame,
    category_insights: dict[int, dict],
) -> dict:
    """Overall DSS dashboard metrics for management visualization.

    How it is calculated
    --------------------
    Aggregates metrics across all analysed categories.

    Original KPIs (preserved):
    - ``total_complaints``, ``unresolved_complaints``, ``resolved_complaints``
    - ``overall_risk_score``, ``overall_risk_level``
    - ``categories_analyzed``, ``categories_above_threshold``
    - ``high_priority_unresolved``, ``avg_appeal_rate_pct``
    - ``top_hotspot_location``

    New KPIs (Goal 12):
    - ``avg_risk_trend`` — average trend direction across categories.
    - ``resolution_quality`` — global resolution quality summary.
    - ``prediction_summary`` — aggregated 30-day prediction.
    - ``highest_confidence_root_cause`` — most reliable finding.
    - ``fastest_improving_category`` — biggest positive trend change.
    - ``fastest_deteriorating_category`` — biggest negative trend change.
    - ``avg_root_cause_confidence`` — average confidence across categories.

    Why it exists
    -------------
    Provides the management dashboard with all KPIs in a single API call.

    Business meaning
    ----------------
    The top-level operational health overview for the entire complaint system.

    Expected range
    --------------
    ``overall_risk_score``: 0–100. ``avg_root_cause_confidence``: 0–100.

    Manager interpretation
    ----------------------
    Start with ``overall_risk_level`` and ``resolution_quality``.
    Drill into ``fastest_deteriorating_category`` for immediate action.

    Returns
    -------
    dict
        All legacy fields preserved, new KPIs added.
    """
    total = len(df)
    unresolved_df = df[df["status"].apply(is_unresolved)]
    resolved_count = total - len(unresolved_df)

    risk_scores = [i["risk"]["risk_score"] for i in category_insights.values()]
    overall_risk = round(sum(risk_scores) / len(risk_scores), 1) if risk_scores else 0.0

    hp_unresolved = int(unresolved_df["is_high_priority"].sum()) if not unresolved_df.empty else 0
    appeal_rate = _safe_pct(int(df["has_appeal"].sum()), total) if total > 0 else 0.0

    loc_info = _dominant_value(df["location"])
    top_hotspot = loc_info["value"] if loc_info else "N/A"

    # ── New KPIs (Goal 12) ──

    # Average risk trend
    trend_changes = [
        i.get("trend", {}).get("change_percentage", 0)
        for i in category_insights.values()
    ]
    avg_trend_change = round(sum(trend_changes) / len(trend_changes), 1) if trend_changes else 0.0
    trend_cfg = _cfg_trend()
    if avg_trend_change >= trend_cfg.get("increasing_threshold_pct", 10):
        avg_trend_direction = "Increasing"
    elif avg_trend_change <= trend_cfg.get("decreasing_threshold_pct", -10):
        avg_trend_direction = "Decreasing"
    else:
        avg_trend_direction = "Stable"

    # Global resolution quality
    quality_scores = [
        i.get("resolution_quality", {}).get("quality_score", 100)
        for i in category_insights.values()
    ]
    avg_quality = round(sum(quality_scores) / len(quality_scores), 1) if quality_scores else 100.0
    if avg_quality >= 85:
        quality_level = "Excellent"
    elif avg_quality >= 70:
        quality_level = "Good"
    elif avg_quality >= 50:
        quality_level = "Fair"
    else:
        quality_level = "Poor"

    # Prediction summary
    predicted_risks = [
        i.get("prediction", {}).get("predicted_risk", 0)
        for i in category_insights.values()
    ]
    avg_predicted_risk = round(sum(predicted_risks) / len(predicted_risks), 1) if predicted_risks else 0.0

    # Highest confidence root cause
    best_confidence = {"category": "N/A", "root_cause": None, "score": 0}
    for insight in category_insights.values():
        rca = insight.get("root_cause_analysis", {})
        cs = rca.get("confidence_score", 0)
        if cs > best_confidence["score"]:
            best_confidence = {
                "category": insight["category_name"],
                "root_cause": rca.get("confident_root_cause"),
                "score": cs,
                "level": rca.get("confidence_level", "Low"),
            }

    # Fastest improving / deteriorating
    trend_items = []
    for insight in category_insights.values():
        change = insight.get("trend", {}).get("change_percentage", 0)
        trend_items.append({
            "category": insight["category_name"],
            "change_pct": change,
        })

    fastest_improving = None
    fastest_deteriorating = None
    if trend_items:
        sorted_by_change = sorted(trend_items, key=lambda x: x["change_pct"])
        if sorted_by_change[0]["change_pct"] < 0:
            fastest_improving = sorted_by_change[0]
        if sorted_by_change[-1]["change_pct"] > 0:
            fastest_deteriorating = sorted_by_change[-1]

    # Average root cause confidence
    confidence_scores = [
        i.get("root_cause_analysis", {}).get("confidence_score", 0)
        for i in category_insights.values()
    ]
    avg_confidence = round(
        sum(confidence_scores) / len(confidence_scores), 1
    ) if confidence_scores else 0.0

    return {
        # Legacy fields (Goal 15)
        "total_complaints": total,
        "unresolved_complaints": len(unresolved_df),
        "resolved_complaints": resolved_count,
        "overall_risk_score": overall_risk,
        "overall_risk_level": risk_level_from_score(overall_risk),
        "categories_analyzed": len(category_insights),
        "categories_above_threshold": len(stats_df),
        "high_priority_unresolved": hp_unresolved,
        "avg_appeal_rate_pct": appeal_rate,
        "top_hotspot_location": top_hotspot,
        "generated_at": datetime.utcnow().isoformat(),
        # New KPIs (Goal 12)
        "avg_risk_trend": {
            "direction": avg_trend_direction,
            "change_pct": avg_trend_change,
        },
        "resolution_quality": {
            "score": avg_quality,
            "level": quality_level,
        },
        "prediction_summary": {
            "avg_predicted_risk": avg_predicted_risk,
            "predicted_risk_level": risk_level_from_score(avg_predicted_risk),
            "window_days": 30,
        },
        "highest_confidence_root_cause": best_confidence,
        "fastest_improving_category": fastest_improving,
        "fastest_deteriorating_category": fastest_deteriorating,
        "avg_root_cause_confidence": avg_confidence,
        # Analytics metadata (User Request #7)
        "analytics_metadata": build_analytics_metadata(),
    }


# ═══════════════════════════════════════════════════════════════════════════════
# §17  EXECUTIVE SUMMARY ENGINE  (Goal 13 — Deterministic, No AI)
# ═══════════════════════════════════════════════════════════════════════════════


def build_executive_summary(
    df: pd.DataFrame,
    stats_df: pd.DataFrame,
    category_insights: dict[int, dict],
    alerts: list[dict],
) -> dict:
    """Data-driven executive summary — no LLM involved.

    Synthesizes the most important findings for management review.

    How it is calculated
    --------------------
    Deterministically assembles narrative sections from analytical outputs:

    1. **Overall operational health** — derived from overall risk level and
       resolution quality.
    2. **Biggest operational risk** — highest-risk category with root cause.
    3. **Biggest improvement** — category with the largest negative trend change.
    4. **Worst trend** — category with the largest positive trend change.
    5. **Prediction** — 30-day risk projection.
    6. **Most reliable root cause** — highest-confidence finding.
    7. **Immediate actions** — derived from high-severity alerts.

    Why it exists
    -------------
    Managers need a one-page summary they can present to leadership.
    This summary is entirely data-driven — no AI-generated narratives.

    Business meaning
    ----------------
    The executive summary is the strategic view of operational risk.

    Expected range
    --------------
    N/A — narrative dict.

    Manager interpretation
    ----------------------
    Start with ``operational_health``, review ``biggest_risk``, then check
    ``immediate_actions`` for what needs to happen today.

    Returns
    -------
    dict
        All legacy fields preserved (``summary``, ``key_findings``,
        ``overall_risk_score``, ``overall_risk_level``, ``generated_at``).
        New fields: ``operational_health``, ``biggest_risk``,
        ``biggest_improvement``, ``worst_trend``, ``prediction_summary``,
        ``most_reliable_root_cause``, ``immediate_actions``.
    """
    dashboard = build_dashboard_metrics(df, stats_df, category_insights)
    ranking = build_category_risk_ranking(category_insights)

    key_findings: list[str] = []

    key_findings.append(
        f"{dashboard['unresolved_complaints']} of {dashboard['total_complaints']} complaints "
        f"remain unresolved (overall risk: {dashboard['overall_risk_level']})."
    )

    if ranking:
        top = ranking[0]
        key_findings.append(
            f"Highest-risk category: {top['category_name']} "
            f"(score {top['risk_score']}, {top['unresolved_count']} open cases)."
        )

    high_alerts = [a for a in alerts if a["severity"] == "high"]
    if high_alerts:
        key_findings.append(f"{len(high_alerts)} high-severity alert(s) require attention.")

    hotspots = [
        i for i in category_insights.values()
        if (i.get("root_cause_analysis", {}).get("hotspot") or {}).get("is_hotspot")
    ]
    if hotspots:
        names = ", ".join(h["category_name"] for h in hotspots[:3])
        key_findings.append(f"Location hotspots detected in: {names}.")

    # Compose narrative summary paragraph (legacy)
    summary_parts = [
        f"Analysis covers {dashboard['total_complaints']} complaints across "
        f"{dashboard['categories_analyzed']} categories over the last 180 days."
    ]
    if ranking:
        summary_parts.append(
            f"The highest operational risk is in '{ranking[0]['category_name']}' "
            f"with a risk score of {ranking[0]['risk_score']}."
        )
    if dashboard["high_priority_unresolved"] > 0:
        summary_parts.append(
            f"There are {dashboard['high_priority_unresolved']} high-priority unresolved cases."
        )
    if high_alerts:
        summary_parts.append(
            f"Management should review {len(high_alerts)} high-severity alerts immediately."
        )

    # ── New: Extended executive summary (Goal 13) ──

    # Operational health
    risk_level = dashboard["overall_risk_level"]
    quality_level = dashboard.get("resolution_quality", {}).get("level", "N/A")
    if risk_level == "Low" and quality_level in ("Excellent", "Good"):
        health = "Healthy"
        health_desc = "Operations are running smoothly with low risk and good resolution quality."
    elif risk_level == "High" or quality_level == "Poor":
        health = "Critical"
        health_desc = "Significant operational issues detected requiring immediate management attention."
    else:
        health = "Needs Attention"
        health_desc = "Moderate operational issues detected. Corrective measures recommended."

    # Biggest risk
    biggest_risk = None
    if ranking:
        top = ranking[0]
        top_insight = category_insights.get(top["category_id"], {})
        biggest_risk = {
            "category": top["category_name"],
            "risk_score": top["risk_score"],
            "root_cause": top_insight.get("root_cause_analysis", {}).get("confident_root_cause"),
            "unresolved_count": top["unresolved_count"],
        }

    # Biggest improvement & worst trend
    trend_items = []
    for insight in category_insights.values():
        change = insight.get("trend", {}).get("change_percentage", 0)
        trend_items.append({
            "category": insight["category_name"],
            "change_pct": change,
            "trend": insight.get("trend", {}).get("trend", "Stable"),
        })

    biggest_improvement = None
    worst_trend = None
    if trend_items:
        sorted_items = sorted(trend_items, key=lambda x: x["change_pct"])
        if sorted_items[0]["change_pct"] < 0:
            biggest_improvement = sorted_items[0]
        if sorted_items[-1]["change_pct"] > 0:
            worst_trend = sorted_items[-1]

    # Prediction
    pred_summary = dashboard.get("prediction_summary", {})

    # Most reliable root cause
    most_reliable = dashboard.get("highest_confidence_root_cause", {})

    # Immediate actions
    immediate_actions: list[str] = []
    for alert in high_alerts[:5]:
        action = alert.get("recommended_action", "")
        if action:
            immediate_actions.append(f"[{alert.get('category_name', 'Unknown')}] {action}")

    return {
        # Legacy fields (Goal 15)
        "summary": " ".join(summary_parts),
        "key_findings": key_findings,
        "overall_risk_score": dashboard["overall_risk_score"],
        "overall_risk_level": dashboard["overall_risk_level"],
        "generated_at": datetime.utcnow().isoformat(),
        # New: Goal 13 — Extended executive summary
        "operational_health": {
            "status": health,
            "description": health_desc,
            "risk_level": risk_level,
            "quality_level": quality_level,
        },
        "biggest_risk": biggest_risk,
        "biggest_improvement": biggest_improvement,
        "worst_trend": worst_trend,
        "prediction_summary": pred_summary,
        "most_reliable_root_cause": most_reliable,
        "immediate_actions": immediate_actions,
        # Analytics metadata
        "analytics_metadata": build_analytics_metadata(),
    }


# ═══════════════════════════════════════════════════════════════════════════════
# §18  LLM PROMPT FORMATTING  (backward compatible)
# ═══════════════════════════════════════════════════════════════════════════════


def format_rca_for_prompt(rca: dict, risk: dict, stats: dict) -> str:
    """Format analytical findings as structured text for the LLM prompt.

    How it is calculated
    --------------------
    Serializes the root cause analysis, risk data, and statistics into a
    human-readable text block the LLM can reference.

    Why it exists
    -------------
    The LLM needs a text representation of findings to generate
    recommendations. This ensures the LLM receives verified data.

    Business meaning
    ----------------
    N/A — internal pipeline utility.

    Manager interpretation
    ----------------------
    Not exposed to managers directly.
    """
    lines = ["=== DATA-DRIVEN ROOT CAUSE ANALYSIS (verified — do not contradict) ==="]

    if rca.get("confident_root_cause"):
        lines.append(f"Primary root cause (data-confirmed): {rca['confident_root_cause']}")

    # Include confidence score for LLM context
    confidence_score = rca.get("confidence_score", 0)
    confidence_level = rca.get("confidence_level", "Low")
    lines.append(f"Root cause confidence: {confidence_score}/100 ({confidence_level})")

    if rca.get("findings"):
        lines.append("Analytical findings:")
        for f in rca["findings"]:
            lines.append(f"  • {f}")

    if rca.get("patterns"):
        lines.append("Detected patterns:")
        for p in rca["patterns"]:
            lines.append(f"  • {p}")

    hotspot = rca.get("hotspot")
    if hotspot:
        status = "HOTSPOT" if hotspot.get("is_hotspot") else "notable"
        lines.append(
            f"Location analysis ({status}): {hotspot['location']} — "
            f"{hotspot['share_pct']:.0f}% of complaints ({hotspot['count']} cases)"
        )

    # Include root cause evidence for LLM context
    evidence_items = rca.get("root_cause_evidence", [])
    if evidence_items:
        lines.append("Root cause evidence (ranked by confidence):")
        for ev in evidence_items[:5]:
            lines.append(f"  • [{ev['confidence']}%] {ev['type']}: {ev['description']}")

    lines.append("")
    lines.append("=== OPERATIONAL RISK (unresolved complaints only) ===")
    lines.append(f"Risk score: {risk['risk_score']} / 100 ({risk['risk_level']})")
    lines.append(f"Unresolved cases: {risk['unresolved_count']} of {stats['complaint_count']}")
    lines.append(f"Unresolved ratio: {risk.get('unresolved_ratio_pct', 0)}%")
    if risk.get("high_priority_unresolved_pct") is not None:
        lines.append(f"High-priority among unresolved: {risk['high_priority_unresolved_pct']}%")

    # Include risk breakdown for richer LLM context
    breakdown = risk.get("risk_breakdown", {})
    if breakdown:
        lines.append("Risk breakdown:")
        for factor_name, factor_data in breakdown.items():
            lines.append(
                f"  • {factor_name}: {factor_data['raw_value']}% "
                f"(contribution: {factor_data['contribution']} pts)"
            )

    return "\n".join(lines)


def apply_analytical_root_cause(groq_result: dict, rca: dict) -> dict:
    """Prefer data-confirmed root cause over LLM-generated root cause.

    The LLM should recommend actions, not fabricate analytical findings.
    """
    result = dict(groq_result)
    confident = rca.get("confident_root_cause")
    if confident:
        result["root_cause"] = confident
    return result
