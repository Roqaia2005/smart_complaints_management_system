"""
dss_analytics.py
================
Data-driven Decision Support analytics for the complaint recommendation pipeline.

All root-cause detection, risk scoring, and alert generation is computed from
complaint data — the LLM only explains and recommends based on these findings.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

import pandas as pd

logger = logging.getLogger(__name__)

# Complaints that still contribute to operational risk
UNRESOLVED_STATUSES = {"pending", "in_progress", "appealed"}

# Thresholds for confident analytical root-cause detection
LOCATION_DOMINANCE_PCT = 40.0
HIGH_PRIORITY_RATE_PCT = 40.0
APPEAL_RATE_PCT = 20.0
TEMPORAL_DOMINANCE_PCT = 35.0

RISK_LEVEL_LOW = "Low"
RISK_LEVEL_MEDIUM = "Medium"
RISK_LEVEL_HIGH = "High"

_CHECKS_PATH = Path(__file__).parent / "checks.json"


def _load_checks_config() -> dict:
    """Load optional per-category threshold overrides from checks.json."""
    try:
        if _CHECKS_PATH.exists():
            with open(_CHECKS_PATH, encoding="utf-8") as fh:
                return json.load(fh)
    except Exception as exc:
        logger.warning("Could not load checks.json: %s", exc)
    return {"enabled": True, "categories": {}}


def is_unresolved(status: Any) -> bool:
    """Return True when a complaint still contributes to operational risk."""
    if status is None or (isinstance(status, float) and pd.isna(status)):
        return True
    return str(status).lower() not in {"resolved"}


def risk_level_from_score(score: float) -> str:
    """Map a 0–100 risk score to Low / Medium / High."""
    if score >= 67:
        return RISK_LEVEL_HIGH
    if score >= 34:
        return RISK_LEVEL_MEDIUM
    return RISK_LEVEL_LOW


def _safe_pct(numerator: int, denominator: int) -> float:
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


def compute_risk_score(group_df: pd.DataFrame) -> dict:
    """
    Compute operational risk from unresolved complaints only.

    Resolved complaints are excluded from the score — they no longer pose
    active operational risk.
    """
    total = len(group_df)
    unresolved_df = group_df[group_df["status"].apply(is_unresolved)]

    if total == 0:
        return {
            "risk_score": 0.0,
            "risk_level": RISK_LEVEL_LOW,
            "unresolved_count": 0,
            "resolved_count": 0,
            "unresolved_ratio_pct": 0.0,
        }

    unresolved_count = len(unresolved_df)
    resolved_count = total - unresolved_count

    if unresolved_count == 0:
        return {
            "risk_score": 0.0,
            "risk_level": RISK_LEVEL_LOW,
            "unresolved_count": 0,
            "resolved_count": resolved_count,
            "unresolved_ratio_pct": 0.0,
        }

    unresolved_ratio = unresolved_count / total
    high_pri_rate = float(unresolved_df["is_high_priority"].mean())
    appeal_rate = float(group_df["has_appeal"].mean())

    # Age factor: older unresolved complaints increase operational risk
    now = pd.Timestamp.now(tz="UTC")
    ages_days = (now - unresolved_df["createdAt"]).dt.total_seconds() / 86400
    avg_age_days = float(ages_days.mean()) if len(ages_days) > 0 else 0.0
    age_factor = min(avg_age_days / 30.0, 1.0)

    score = (
        unresolved_ratio * 35
        + high_pri_rate * 30
        + appeal_rate * 20
        + age_factor * 15
    )
    score = round(min(max(score, 0.0), 100.0), 1)

    return {
        "risk_score": score,
        "risk_level": risk_level_from_score(score),
        "unresolved_count": unresolved_count,
        "resolved_count": resolved_count,
        "unresolved_ratio_pct": _safe_pct(unresolved_count, total),
        "high_priority_unresolved_pct": _safe_pct(
            int(unresolved_df["is_high_priority"].sum()), unresolved_count
        ),
        "avg_unresolved_age_days": round(avg_age_days, 1),
    }


def analyze_root_causes(
    group_df: pd.DataFrame,
    keywords: list[str],
    stats_row: Optional[dict] = None,
) -> dict:
    """
    Data-driven root cause analysis for a single complaint category.

    Returns structured findings the LLM must use rather than invent.
    """
    findings: list[str] = []
    confident_root_cause: Optional[str] = None
    stats_row = stats_row or {}

    total = len(group_df)
    unresolved_df = group_df[group_df["status"].apply(is_unresolved)]

    # ── Location hotspot ──
    location_info = _dominant_value(group_df["location"], min_share_pct=LOCATION_DOMINANCE_PCT)
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
    day_info = _dominant_value(group_df["day_of_week"], min_share_pct=TEMPORAL_DOMINANCE_PCT)
    month_info = _dominant_value(group_df["month"], min_share_pct=TEMPORAL_DOMINANCE_PCT)
    patterns: list[str] = []
    if day_info and day_info["dominant"]:
        patterns.append(f"Peak day: {day_info['value']} ({day_info['share_pct']:.0f}% of complaints)")
    if month_info and month_info["dominant"]:
        patterns.append(f"Peak month: {month_info['value']} ({month_info['share_pct']:.0f}% of complaints)")
    findings.extend(patterns)

    # ── High-priority cluster (unresolved only) ──
    if not unresolved_df.empty:
        hp_unresolved = int(unresolved_df["is_high_priority"].sum())
        hp_pct = _safe_pct(hp_unresolved, len(unresolved_df))
        if hp_pct >= HIGH_PRIORITY_RATE_PCT:
            msg = f"High-priority unresolved issues: {hp_unresolved} ({hp_pct:.0f}% of open cases)"
            findings.append(msg)
            if confident_root_cause is None:
                confident_root_cause = (
                    f"{hp_pct:.0f}% of unresolved complaints are high-priority, "
                    f"indicating urgent systemic issues requiring immediate attention."
                )

    # ── Appeal pattern ──
    appeal_rate_pct = float(stats_row.get("appeal_rate_pct") or 0)
    if appeal_rate_pct >= APPEAL_RATE_PCT:
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

    return {
        "findings": findings,
        "confident_root_cause": confident_root_cause,
        "hotspot": hotspot,
        "patterns": patterns,
        "dominant_keywords": keywords[:8],
        "appeal_rate_pct": appeal_rate_pct,
        "high_priority_pct": float(stats_row.get("high_priority_pct") or 0),
    }


def generate_smart_alerts(
    df: pd.DataFrame,
    stats_df: pd.DataFrame,
    category_insights: dict[int, dict],
) -> list[dict]:
    """Generate threshold-based alerts suitable for dashboard display."""
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

        risk_score = risk.get("risk_score", 0)
        if risk_score >= 67:
            alerts.append({
                "severity": "high",
                "category_id": cat_id,
                "category_name": cat_name,
                "alert_type": "high_risk",
                "message": f"{cat_name}: operational risk score is {risk_score} (High)",
                "metric_value": risk_score,
            })
        elif risk_score >= 34:
            alerts.append({
                "severity": "medium",
                "category_id": cat_id,
                "category_name": cat_name,
                "alert_type": "elevated_risk",
                "message": f"{cat_name}: operational risk score is {risk_score} (Medium)",
                "metric_value": risk_score,
            })

        appeal_pct = float(row.get("appeal_rate_pct") or 0)
        if appeal_pct >= APPEAL_RATE_PCT:
            alerts.append({
                "severity": "high" if appeal_pct >= 30 else "medium",
                "category_id": cat_id,
                "category_name": cat_name,
                "alert_type": "high_appeal_rate",
                "message": f"{cat_name}: appeal rate is {appeal_pct:.0f}%",
                "metric_value": appeal_pct,
            })

        hp_pct = float(row.get("high_priority_pct") or 0)
        if hp_pct >= HIGH_PRIORITY_RATE_PCT:
            alerts.append({
                "severity": "high",
                "category_id": cat_id,
                "category_name": cat_name,
                "alert_type": "high_priority_cluster",
                "message": f"{cat_name}: {hp_pct:.0f}% of complaints are high-priority",
                "metric_value": hp_pct,
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
            })

        unresolved = risk.get("unresolved_count", 0)
        if unresolved >= 10:
            alerts.append({
                "severity": "medium",
                "category_id": cat_id,
                "category_name": cat_name,
                "alert_type": "backlog",
                "message": f"{cat_name}: {unresolved} unresolved complaints",
                "metric_value": float(unresolved),
            })

    # Sort by severity (high first) then metric value descending
    severity_order = {"high": 0, "medium": 1, "low": 2}
    alerts.sort(key=lambda a: (severity_order.get(a["severity"], 3), -a["metric_value"]))
    return alerts


def build_category_insights(
    df: pd.DataFrame,
    stats_df: pd.DataFrame,
    keywords_by_category: Optional[dict[int, list[str]]] = None,
) -> dict[int, dict]:
    """
    Build per-category DSS insight bundle used by the pipeline and APIs.

    keywords_by_category: pre-computed TF-IDF keywords; computed lazily if omitted.
    """
    keywords_by_category = keywords_by_category or {}
    insights: dict[int, dict] = {}

    for _, row in stats_df.iterrows():
        cat_id = int(row["category_id"])
        group_df = df[df["category_id"] == cat_id]
        keywords = keywords_by_category.get(cat_id, [])
        stats_dict = row.to_dict()

        risk = compute_risk_score(group_df)
        rca = analyze_root_causes(group_df, keywords, stats_dict)

        insights[cat_id] = {
            "category_id": cat_id,
            "category_name": str(row["category_name"]),
            "risk": risk,
            "root_cause_analysis": rca,
            "stats": {
                "complaint_count": int(row["complaint_count"]),
                "avg_res_hours": float(row["avg_res_hours"]),
                "appeal_rate_pct": float(row["appeal_rate_pct"]),
                "high_priority_pct": float(row["high_priority_pct"]),
                "peak_day": str(row["peak_day"]),
                "peak_month": str(row["peak_month"]),
                "top_location": str(row["top_location"]),
            },
        }

    return insights


def build_category_risk_ranking(category_insights: dict[int, dict]) -> list[dict]:
    """Rank categories by operational risk score for dashboard charts."""
    ranking = []
    for cat_id, insight in category_insights.items():
        risk = insight["risk"]
        stats = insight["stats"]
        rca = insight["root_cause_analysis"]
        ranking.append({
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
        })

    ranking.sort(key=lambda x: x["risk_score"], reverse=True)
    for i, item in enumerate(ranking, start=1):
        item["rank"] = i
    return ranking


def build_dashboard_metrics(
    df: pd.DataFrame,
    stats_df: pd.DataFrame,
    category_insights: dict[int, dict],
) -> dict:
    """Overall DSS dashboard metrics for management visualization."""
    total = len(df)
    unresolved_df = df[df["status"].apply(is_unresolved)]
    resolved_count = total - len(unresolved_df)

    risk_scores = [i["risk"]["risk_score"] for i in category_insights.values()]
    overall_risk = round(sum(risk_scores) / len(risk_scores), 1) if risk_scores else 0.0

    hp_unresolved = int(unresolved_df["is_high_priority"].sum()) if not unresolved_df.empty else 0
    appeal_rate = _safe_pct(int(df["has_appeal"].sum()), total) if total > 0 else 0.0

    loc_info = _dominant_value(df["location"])
    top_hotspot = loc_info["value"] if loc_info else "N/A"

    return {
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
    }


def build_executive_summary(
    df: pd.DataFrame,
    stats_df: pd.DataFrame,
    category_insights: dict[int, dict],
    alerts: list[dict],
) -> dict:
    """
    Data-driven executive summary — no LLM involved.

    Synthesizes the most important findings for management review.
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

    # Compose narrative summary paragraph
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

    return {
        "summary": " ".join(summary_parts),
        "key_findings": key_findings,
        "overall_risk_score": dashboard["overall_risk_score"],
        "overall_risk_level": dashboard["overall_risk_level"],
        "generated_at": datetime.utcnow().isoformat(),
    }


def format_rca_for_prompt(rca: dict, risk: dict, stats: dict) -> str:
    """Format analytical findings as structured text for the LLM prompt."""
    lines = ["=== DATA-DRIVEN ROOT CAUSE ANALYSIS (verified — do not contradict) ==="]

    if rca.get("confident_root_cause"):
        lines.append(f"Primary root cause (data-confirmed): {rca['confident_root_cause']}")

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

    lines.append("")
    lines.append("=== OPERATIONAL RISK (unresolved complaints only) ===")
    lines.append(f"Risk score: {risk['risk_score']} / 100 ({risk['risk_level']})")
    lines.append(f"Unresolved cases: {risk['unresolved_count']} of {stats['complaint_count']}")
    lines.append(f"Unresolved ratio: {risk.get('unresolved_ratio_pct', 0)}%")
    if risk.get("high_priority_unresolved_pct") is not None:
        lines.append(f"High-priority among unresolved: {risk['high_priority_unresolved_pct']}%")

    return "\n".join(lines)


def apply_analytical_root_cause(groq_result: dict, rca: dict) -> dict:
    """
    Prefer data-confirmed root cause over LLM-generated root cause.

    The LLM should recommend actions, not fabricate analytical findings.
    """
    result = dict(groq_result)
    confident = rca.get("confident_root_cause")
    if confident:
        result["root_cause"] = confident
    return result
