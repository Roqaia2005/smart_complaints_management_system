"""
recommendation_templates.py
============================
Deterministic, non-LLM fallback for recommendation generation.

WHY THIS EXISTS
---------------
Today, if the Groq call in recommendation.py fails for a category (rate
limit, timeout, malformed JSON), that category is simply skipped for this
pipeline run -- logged and dropped, no recommendation saved at all. That's
a bad failure mode for something managers rely on: "no Groq" silently
becomes "missing data" rather than "slightly more generic data."

This module produces a recommendation with the EXACT SAME SHAPE Groq
returns:
    {pattern_detected, root_cause, recommendation, urgency, estimated_impact}
so it's a drop-in substitute anywhere a Groq result is consumed
(apply_analytical_root_cause(), save_recommendation()) -- callers don't
need to know or care whether a given recommendation came from the LLM or
this template engine.

This mirrors the same design philosophy already used for the Executive
Briefing (briefing.py): assemble already-computed DSS analytics into
fixed sentence templates, with zero LLM involvement and zero hallucination
risk. Every sentence below is built from real per-category numbers (risk
score, hotspot location, keywords, SLA status, decision priority), so
different categories genuinely produce different text -- it's templated,
not identical boilerplate copy-pasted across every recommendation. It will
read more formulaic than Groq's prose, which is the intentional trade-off
of a fallback: available and grounded beats unavailable.
"""

from __future__ import annotations

from typing import Any, Optional


def _pattern_detected(row: dict, keywords: list[str]) -> str:
    count = int(row.get("complaint_count") or 0)
    category_name = row.get("category_name", "this category")
    if keywords:
        kw = ", ".join(keywords[:3])
        return (
            f"{count} complaints logged for {category_name} over the last 180 days, "
            f"most frequently referencing: {kw}."
        )
    return f"{count} complaints logged for {category_name} over the last 180 days."


# risk_breakdown's raw_value is already a plain number in the factor's own
# unit (a percentage like 72.3 for the rate-based factors, or a day count
# for aging) -- NOT a 0-1 fraction. Map each factor to its label + unit so
# the fallback sentence reads correctly instead of guessing a format.
_RISK_FACTOR_LABELS: dict[str, tuple[str, str]] = {
    "unresolved_ratio": ("unresolved rate", "%"),
    "high_priority": ("high-priority rate", "%"),
    "appeal_rate": ("appeal rate", "%"),
    "aging": ("average age of unresolved complaints", " days"),
}


def _root_cause(rca: dict, risk: dict) -> str:
    confident = rca.get("confident_root_cause")
    if confident:
        return confident

    # No single confirmed root cause -- fall back to whichever risk factor
    # contributed the most to the risk score, so the statement is still
    # grounded in a specific number rather than a vague generality.
    breakdown = risk.get("risk_breakdown") or {}
    if breakdown:
        top_factor = max(breakdown.items(), key=lambda kv: kv[1].get("contribution", 0), default=None)
        if top_factor:
            factor_name, factor_data = top_factor
            label, unit = _RISK_FACTOR_LABELS.get(factor_name, (factor_name.replace("_", " "), ""))
            raw_value = factor_data.get("raw_value")
            if raw_value is not None:
                return (
                    f"No single dominant root cause was confirmed by the data; "
                    f"the largest contributor to the current risk level is {label} "
                    f"({raw_value}{unit})."
                )
            return (
                f"No single dominant root cause was confirmed by the data; "
                f"the largest contributor to the current risk level is {label}."
            )

    return (
        f"No single dominant root cause was confirmed by the data available; "
        f"risk level is {risk.get('risk_level', 'Medium')} based on overall volume and resolution metrics."
    )


def _recommendation(rca: dict, risk: dict, resolution_q: dict, category_name: str) -> str:
    hotspot = rca.get("hotspot") or {}
    if hotspot.get("location"):
        share = hotspot.get("share_pct")
        share_txt = f"{share}%" if share is not None else "a large share"
        return (
            f"Investigate operational conditions at {hotspot['location']}, which accounts for "
            f"{share_txt} of {category_name} complaints -- this points to a facility-specific "
            f"issue rather than a systemic one across all locations."
        )

    if resolution_q.get("sla_status") == "breached":
        sla_hours = resolution_q.get("sla_hours")
        sla_txt = f"the {sla_hours:.0f}h SLA" if sla_hours else "the expected SLA"
        return (
            f"Prioritize clearing the backlog of {category_name} complaints -- average "
            f"resolution time is currently exceeding {sla_txt}. Consider reallocating staff "
            f"or reviewing the resolution workflow for this category."
        )

    unresolved = risk.get("unresolved_count", 0)
    if unresolved:
        return (
            f"Prioritize resolving the {unresolved} outstanding {category_name} complaints, "
            f"starting with high-priority cases, to prevent further risk escalation."
        )

    return (
        f"Continue routine monitoring of {category_name}; current metrics do not indicate "
        f"an immediate action beyond standard review."
    )


def _urgency(decision_priority: dict, risk: dict) -> str:
    level = (decision_priority or {}).get("level") or risk.get("risk_level") or "Medium"
    return {
        "Critical": "high",
        "High": "high",
        "Medium": "medium",
        "Low": "low",
    }.get(level, "medium")


def _estimated_impact(risk: dict, category_name: str) -> str:
    unresolved = risk.get("unresolved_count", 0)
    risk_level = risk.get("risk_level", "Medium")
    if unresolved:
        return (
            f"Acting on this could reduce the unresolved {category_name} backlog "
            f"(currently {unresolved} cases) and lower the category's {risk_level.lower()} risk level."
        )
    if category_name.endswith('s'):
        return f"Continued attention should help keep the {risk_level.lower()} risk level for {category_name} stable or improving."
    return f"Continued attention should help keep {category_name}'s {risk_level.lower()} risk level stable or improving."


def build_template_recommendation(
    row: dict[str, Any],
    insight: dict[str, Any],
    keywords: list[str],
) -> dict[str, str]:
    """Build a recommendation dict entirely from DSS analytics, no LLM call.

    Parameters mirror what recommendation.py already has on hand for a
    category, so this can be called as a direct substitute for call_groq()
    at the point where a Groq call just failed:

        row:      stats_df row for this category, as a dict (category_name,
                  complaint_count, avg_res_hours, appeal_rate_pct, etc.)
        insight:  this category's entry from build_category_insights()
                  (risk, root_cause_analysis, decision_priority,
                  resolution_quality)
        keywords: TF-IDF keywords already extracted for this category

    Returns the same 5-key shape as call_groq():
        {pattern_detected, root_cause, recommendation, urgency, estimated_impact}
    """
    rca = insight.get("root_cause_analysis") or {}
    risk = insight.get("risk") or {}
    decision_priority = insight.get("decision_priority") or {}
    resolution_q = insight.get("resolution_quality") or {}
    category_name = row.get("category_name", "this category")

    return {
        "pattern_detected": _pattern_detected(row, keywords),
        "root_cause": _root_cause(rca, risk),
        "recommendation": _recommendation(rca, risk, resolution_q, category_name),
        "urgency": _urgency(decision_priority, risk),
        "estimated_impact": _estimated_impact(risk, category_name),
    }