"""
Target path: assistant/services/director.py  (REPLACES existing file)

Conversation Director for agenda, context slicing, and pacing.

CHANGE IN THIS VERSION
------------------------
build_script() used to be a plain sync method that looped over all 9
agenda steps and made a BLOCKING, SEQUENTIAL Groq API call for each one
before returning. Two problems with that:

1. It was called directly (un-awaited) from inside `async def
   generate_briefing(...)` in assistant/routes.py. Since Groq's Python
   SDK is synchronous, every one of those 9 calls blocked the asyncio
   event loop -- which means it froze the ENTIRE FastAPI process for
   every other concurrent request (other users' /ask, /session-status,
   /stt, even unrelated DSS endpoints if they shared the loop) for the
   full duration of briefing generation.

2. Even ignoring the event-loop issue, making 9 LLM calls one after
   another is just slow -- 9x the latency of making them in parallel.

The 9 agenda steps don't depend on each other's *generated text* (only
on the pre-built analytics_snapshot, which is already computed up
front), so they're safe to run concurrently. build_script() is now
`async def` and fans the 9 calls out across a small thread pool via
asyncio.gather(), which:
  - takes the blocking Groq calls off the event loop entirely, and
  - cuts wall-clock time from ~9x a single call down to ~1x (bounded by
    ASSISTANT_DIALOGUE_WORKERS concurrent workers).

Order is preserved: asyncio.gather() returns results in the same order
the awaitables were passed in, regardless of completion order.

Callers: assistant/routes.py now does
    dialogue = await conversation_director.build_script(snapshot)
instead of the old synchronous call.
"""

from __future__ import annotations

import asyncio
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Optional

from assistant.config import ASSISTANT_DIALOGUE_WORKERS
from assistant.prompts.builder import PromptBuilder
from assistant.schemas import DialogueSegment
from assistant.services.conversation import ConversationManager

_DIALOGUE_EXECUTOR = ThreadPoolExecutor(
    max_workers=ASSISTANT_DIALOGUE_WORKERS,
    thread_name_prefix="assistant-dialogue",
)


class ConversationDirector:
    """Controls briefing agenda and keeps LLM context tightly sliced."""

    def __init__(
        self,
        prompt_builder: Optional[PromptBuilder] = None,
        conversation_manager: Optional[ConversationManager] = None,
    ) -> None:
        self.prompt_builder = prompt_builder or PromptBuilder()
        self.conversation_manager = conversation_manager or ConversationManager()
        self.agenda: list[dict[str, Any]] = [
            {"step": 0, "topic": "introduction", "speaker": "host", "focus": "Welcome and executive context setting"},
            {"step": 1, "topic": "kpi_summary", "speaker": "analyst", "focus": "Key performance indicators and operational health"},
            {"step": 2, "topic": "risk_overview", "speaker": "host", "focus": "Questioning overall risk landscape"},
            {"step": 3, "topic": "category_ranking", "speaker": "analyst", "focus": "Category-by-category risk ranking with metrics"},
            {"step": 4, "topic": "hotspots", "speaker": "host", "focus": "Identifying geographic and operational hotspots"},
            {"step": 5, "topic": "alerts", "speaker": "analyst", "focus": "Critical alerts requiring immediate attention"},
            {"step": 6, "topic": "recommendations", "speaker": "host", "focus": "Strategic recommendations and priorities"},
            {"step": 7, "topic": "action_plan", "speaker": "analyst", "focus": "Concrete action plan with owners and timelines"},
            {"step": 8, "topic": "closing", "speaker": "host", "focus": "Summary and closing remarks"},
        ]

    def get_agenda_step(self, index: int) -> dict[str, Any]:
        if 0 <= index < len(self.agenda):
            return self.agenda[index]
        return {"step": index, "topic": "conclusion", "speaker": "host", "focus": "Closing statements"}

    async def build_script(self, analytics_snapshot: dict[str, Any]) -> list[DialogueSegment]:
        """Generate all agenda-step dialogue turns concurrently."""
        loop = asyncio.get_running_loop()
        tasks = [
            loop.run_in_executor(
                _DIALOGUE_EXECUTOR,
                self._build_turn_sync,
                index,
                step,
                analytics_snapshot,
            )
            for index, step in enumerate(self.agenda)
        ]
        return list(await asyncio.gather(*tasks))

    def _build_turn_sync(
        self,
        index: int,
        step: dict[str, Any],
        analytics_snapshot: dict[str, Any],
    ) -> DialogueSegment:
        """Blocking work for a single agenda step. Runs inside the thread pool."""
        context_slice = self.slice_context(step["topic"], analytics_snapshot)
        fallback = self._fallback_turn(step, context_slice)
        system_prompt, user_prompt = self.prompt_builder.build_briefing_turn_prompt(step, context_slice)
        return self.conversation_manager.generate_dialogue_turn(
            index=index,
            expected_speaker=step["speaker"],
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            fallback_text=fallback["text"],
            fallback_topic=fallback["topic"],
            risk_score=fallback.get("risk_score"),
            recommendation=fallback.get("recommendation"),
        )

    def slice_context(self, topic: str, analytics_snapshot: dict[str, Any]) -> dict[str, Any]:
        dashboard = analytics_snapshot.get("dashboard", {})
        ranking = analytics_snapshot.get("risk_ranking", [])
        recommendations = analytics_snapshot.get("recommendations", [])
        alerts = analytics_snapshot.get("alerts", [])
        category_details = analytics_snapshot.get("category_details", {})

        top_risk = ranking[0] if ranking else {}
        top_category_id = str(top_risk.get("category_id", ""))
        top_detail = category_details.get(top_category_id) or category_details.get(top_risk.get("category_id")) or {}
        top_recommendation = recommendations[0] if recommendations else {}

        if topic == "introduction":
            return {
                "generated_at": analytics_snapshot.get("generated_at"),
                "dashboard": dashboard,
                "executive_summary": analytics_snapshot.get("executive_summary", {}),
            }
        if topic == "kpi_summary":
            return {"dashboard": dashboard}
        if topic == "risk_overview":
            return {"risk_ranking": ranking[:3], "dashboard": dashboard}
        if topic == "category_ranking":
            return {"risk_ranking": ranking[:5], "category_details": dict(list(category_details.items())[:3])}
        if topic == "hotspots":
            return {
                "top_risk": top_risk,
                "category_detail": top_detail,
                "location_intelligence": top_detail.get("location_intelligence"),
            }
        if topic == "alerts":
            return {"alerts": alerts[:5], "dashboard": dashboard}
        if topic == "recommendations":
            return {
                "top_risk": top_risk,
                "recommendations": recommendations[:5],
                "category_detail": top_detail,
            }
        if topic == "action_plan":
            return {
                "top_recommendation": top_recommendation,
                "recommendations": recommendations[:3],
                "alerts": alerts[:3],
            }
        if topic == "closing":
            return {
                "dashboard": dashboard,
                "top_risk": top_risk,
                "top_recommendation": top_recommendation,
                "alerts_count": len(alerts),
            }
        return {"dashboard": dashboard, "top_risk": top_risk}

    def build_resume_bridge(self, segment: Optional[DialogueSegment]) -> str:
        if not segment:
            return "Returning to the briefing."
        if segment.speaker == "host":
            return "Right, going back to my question."
        return "To continue where we left off."

    def _fallback_turn(self, step: dict[str, Any], context_slice: dict[str, Any]) -> dict[str, Any]:
        topic = step["topic"]
        dashboard = context_slice.get("dashboard", {})
        top_risk = context_slice.get("top_risk") or (context_slice.get("risk_ranking", [{}])[0] if context_slice.get("risk_ranking") else {})
        alerts = context_slice.get("alerts", [])
        recommendations = context_slice.get("recommendations", [])
        top_recommendation = context_slice.get("top_recommendation", {})

        if topic == "introduction":
            return {
                "topic": "Introduction",
                "text": "Good morning, everyone. Welcome to today's university operational briefing. I'll guide you through the key insights from our complaint management system.",
            }
        if topic == "kpi_summary":
            total = dashboard.get("total_complaints", "N/A")
            unresolved = dashboard.get("unresolved_complaints", "N/A")
            risk = dashboard.get("overall_risk_score", "N/A")
            return {
                "topic": "KPI Summary",
                "text": f"Our dashboard currently shows {total} total complaints, with {unresolved} still unresolved. The overall operational risk score stands at {risk}.",
                "risk_score": risk if isinstance(risk, (int, float)) else None,
            }
        if topic == "risk_overview":
            return {
                "topic": "Risk Overview",
                "text": "Let me walk you through the current risk landscape. We have several categories requiring management attention, with varying levels of urgency and impact.",
            }
        if topic == "category_ranking":
            name = top_risk.get("category_name", "the highest risk category")
            score = top_risk.get("risk_score", "N/A")
            return {
                "topic": "Category Ranking",
                "text": f"{name} leads our risk ranking with a score of {score}. Shall we examine the specific factors driving this assessment?",
                "risk_score": score if isinstance(score, (int, float)) else None,
            }
        if topic == "hotspots":
            name = top_risk.get("category_name", "the leading category")
            location = top_risk.get("location", "multiple locations")
            return {
                "topic": "Hotspots",
                "text": f"The primary hotspot for {name} is concentrated around {location}. This geographic clustering suggests localized operational challenges.",
            }
        if topic == "alerts":
            count = len(alerts)
            critical = sum(1 for a in alerts if a.get("severity") == "critical")
            return {
                "topic": "Alerts",
                "text": f"We have {count} active alerts, with {critical} requiring immediate executive attention. Let me highlight the most critical ones.",
            }
        if topic == "recommendations":
            rec_text = top_recommendation.get("recommendation") or (recommendations[0].get("recommendation") if recommendations else None)
            return {
                "topic": "Recommendations",
                "text": rec_text or "Based on our analysis, I recommend prioritizing the highest-risk category and assigning dedicated owners for corrective action.",
                "recommendation": rec_text,
            }
        if topic == "action_plan":
            urgency = top_recommendation.get("urgency", "high")
            impact = top_recommendation.get("estimated_impact", "significant")
            return {
                "topic": "Action Plan",
                "text": f"Our recommended action plan carries {urgency} urgency with {impact} expected impact. Specific owners and timelines should be assigned within the next 48 hours.",
                "recommendation": top_recommendation.get("recommendation"),
            }
        if topic == "closing":
            return {
                "topic": "Closing",
                "text": "That concludes our executive briefing. The key takeaway is immediate action on the top-ranked risk category. I'm now available for any follow-up questions.",
            }
        return {"topic": "Conclusion", "text": "That concludes the executive briefing."}