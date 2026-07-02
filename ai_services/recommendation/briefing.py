"""
briefing.py
===========
Simple Executive Briefing Builder for the Recommendation Service.

This module generates a structured executive briefing from existing DSS analytics.
It does NOT use the LLM to generate content - it only reads from the analytics
that are already computed by the DSS engine.

CHANGES IN THIS VERSION
-----------------------
Initial implementation - replaces the complex AI assistant dialogue system
with a simple, reliable briefing that reads out DSS analytics.
"""

from __future__ import annotations

import logging
from translation import translate_to_english
from datetime import datetime
from typing import Any, Optional

logger = logging.getLogger(__name__)


def build_executive_briefing(
    dashboard_metrics: dict[str, Any],
    risk_ranking: list[dict[str, Any]],
    executive_summary: dict[str, Any],
    alerts: list[dict[str, Any]],
    recommendations: list[dict[str, Any]],
) -> list[dict[str, str]]:
    """Build a structured executive briefing from DSS analytics.
    
    This function creates an ordered list of briefing sections that can be
    read aloud by TTS or displayed in the UI. All data comes from existing
    DSS analytics - no LLM generation.
    
    Parameters
    ----------
    dashboard_metrics : dict
        Dashboard metrics from /api/dss/dashboard
    risk_ranking : list[dict]
        Category risk ranking from /api/dss/risk-ranking
    executive_summary : dict
        Executive summary from /api/dss/executive-summary
    alerts : list[dict]
        Smart alerts from /api/dss/alerts
    recommendations : list[dict]
        Recommendations from /api/manager/recommendations
    
    Returns
    -------
    list[dict]
        Ordered list of briefing sections, each with:
        - section: section name
        - text: the text to be read/displayed
    """
    sections = []
    
    # Section 1: Introduction
    sections.append({
        "section": "introduction",
        "text": "Good morning. This executive briefing summarizes the latest complaint analytics for your faculty."
    })
    
    # Section 2: Executive Summary
    if executive_summary and executive_summary.get("summary"):
        sections.append({
            "section": "executive_summary",
            "text": executive_summary["summary"]
        })
    
    # Section 3: KPI Summary
    if dashboard_metrics:
        total = dashboard_metrics.get("total_complaints", 0)
        unresolved = dashboard_metrics.get("unresolved_complaints", 0)
        resolved = dashboard_metrics.get("resolved_complaints", 0)
        risk_score = dashboard_metrics.get("overall_risk_score", 0)
        risk_level = dashboard_metrics.get("overall_risk_level", "Low")
        
        kpi_text = (
            f"Over the selected reporting period, the faculty received {total} complaints. "
            f"Currently {unresolved} complaints remain unresolved, and {resolved} have been resolved. "
            f"The overall operational risk score is {risk_score}, which is rated as {risk_level}."
        )
        sections.append({
            "section": "kpi_summary",
            "text": kpi_text
        })
    
    # Section 4: Risk Overview
    if risk_ranking:
        high_risk_count = sum(1 for r in risk_ranking if r.get("risk_level") == "High")
        medium_risk_count = sum(1 for r in risk_ranking if r.get("risk_level") == "Medium")
        
        risk_text = f"The system analyzed {len(risk_ranking)} complaint categories. "
        if high_risk_count > 0:
            risk_text += f"{high_risk_count} categories are rated as high risk. "
        if medium_risk_count > 0:
            risk_text += f"{medium_risk_count} categories are rated as medium risk. "
        
        sections.append({
            "section": "risk_overview",
            "text": risk_text.strip()
        })
    
    # Section 5: Top Risk Category
    if risk_ranking and len(risk_ranking) > 0:
        top_category = risk_ranking[0]
        category_name = top_category.get("category_name", "Unknown")
        risk_score = top_category.get("risk_score", 0)
        risk_level = top_category.get("risk_level", "Low")
        unresolved = top_category.get("unresolved_count", 0)
        
        top_text = (
            f"The highest risk category is {category_name} with a risk score of {risk_score} "
            f"({risk_level}). This category has {unresolved} unresolved complaints."
        )
        sections.append({
            "section": "top_category",
            "text": top_text
        })
    
    # Section 6: Critical Alerts
    if alerts:
        critical_alerts = [a for a in alerts if a.get("severity") == "high"]
        alert_count = len(critical_alerts) if critical_alerts else len(alerts)
        
        alert_text = f"{alert_count} critical alerts require immediate attention. "
        if critical_alerts:
            alert_text += "These include: " + ", ".join(
                a.get("message", "") for a in critical_alerts[:3]
            )
        
        sections.append({
            "section": "alerts",
            "text": alert_text.strip()
        })
    
    # Section 7: Recommendations
    if recommendations:
        pending_recs = [r for r in recommendations if r.get("status") == "pending"]
        if pending_recs:
            top_rec = pending_recs[0]
            rec_text = top_rec.get("recommendation", "")
            impact = top_rec.get("estimated_impact", "")
            urgency = top_rec.get("urgency", "medium")
            
            rec_section = (
                f"The recommendation engine suggests: {rec_text}. "
                f"Estimated impact: {impact}. "
                f"This recommendation is marked as {urgency} urgency."
            )
            sections.append({
                "section": "recommendations",
                "text": rec_section
            })
    
    # Section 8: Closing
    sections.append({
        "section": "closing",
        "text": "That concludes today's executive briefing. Please review the dashboard for detailed analytics and take appropriate action on critical items."
    })
    
    logger.info(f"Built executive briefing with {len(sections)} sections")


    # Category names and locations come straight from the DB and can be
    # Arabic, even though the surrounding sentence is an English template.
    # Translate the fully-assembled section text (not just the raw DB
    # fields) so both the displayed sections and the TTS voice selection
    # see consistent English.
    texts = [s["text"] for s in sections]
    translated_texts = translate_to_english(texts)
    for section, translated_text in zip(sections, translated_texts):
        section["text"] = translated_text

    logger.info(f"Built executive briefing with {len(sections)} sections")
    
    return sections


def format_briefing_for_tts(sections: list[dict[str, str]]) -> str:
    """Convert briefing sections to a single string for TTS.
    
    Parameters
    ----------
    sections : list[dict]
        List of briefing sections from build_executive_briefing()
    
    Returns
    -------
    str
        Complete briefing text with pauses between sections
    """
    if not sections:
        return "No briefing data available at this time."
    
    # Join sections with pauses for natural speech
    texts = [s["text"] for s in sections]
    return ". ".join(texts)


def get_briefing_section(sections: list[dict[str, str]], section_name: str) -> Optional[dict[str, str]]:
    """Get a specific section from the briefing.
    
    Parameters
    ----------
    sections : list[dict]
        List of briefing sections
    section_name : str
        Name of the section to retrieve
    
    Returns
    -------
    dict or None
        The requested section, or None if not found
    """
    for section in sections:
        if section["section"] == section_name:
            return section
    return None