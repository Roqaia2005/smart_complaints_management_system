"""
Target path: assistant/services/router.py  (REPLACES existing file)

Intent router for deterministic answers vs. LLM synthesis.

CHANGE IN THIS VERSION
------------------------
_suggested_questions() used to be a second, separately-maintained copy of
the question list that lived in assistant/routes.py. The two had already
drifted: routes.py had the better "executive style" questions from the
architecture doc's wishlist, router.py still had the older generic set.
That meant a manager would see good suggested questions after the
initial briefing, then worse ones after every follow-up answer. Both now
import from assistant/services/suggestions.py, so there's exactly one
place this logic lives.

Note: answer() is still a plain sync method (it makes a blocking Groq
call internally via ConversationManager). It must be called via
`asyncio.to_thread(...)` from any `async def` route -- see the fix in
assistant/routes.py's ask_question handler.
"""

from __future__ import annotations

import re
from typing import Any, Optional

from assistant.prompts.builder import PromptBuilder
from assistant.services.conversation import ConversationManager
from assistant.services.director import ConversationDirector
from assistant.services.suggestions import build_suggested_questions


class IntentRouter:
    """Routes questions to direct DSS lookup or conversational synthesis."""

    def __init__(
        self,
        director: Optional[ConversationDirector] = None,
        prompt_builder: Optional[PromptBuilder] = None,
        conversation_manager: Optional[ConversationManager] = None,
    ) -> None:
        self.director = director or ConversationDirector()
        self.prompt_builder = prompt_builder or PromptBuilder()
        self.conversation_manager = conversation_manager or ConversationManager()

    def answer(
        self,
        question: str,
        analytics_snapshot: dict[str, Any],
        state: dict[str, Any],
    ) -> tuple[str, list[str]]:
        deterministic = self._answer_deterministic(question, analytics_snapshot)
        if deterministic:
            return deterministic, build_suggested_questions(analytics_snapshot)

        topic = str(state.get("active_topic") or "risk_breakdown").lower().replace(" ", "_")
        context_slice = self.director.slice_context(topic, analytics_snapshot)
        system_prompt, user_prompt = self.prompt_builder.build_answer_prompt(
            state=state,
            context_slice=context_slice,
            question=question,
        )
        fallback = "The current analytics do not provide enough detail to answer that fully. I recommend reviewing the top risk category, unresolved cases, and active alerts before deciding."
        answer, suggested = self.conversation_manager.answer_question(system_prompt, user_prompt, fallback)
        return answer, suggested or build_suggested_questions(analytics_snapshot)

    def _answer_deterministic(self, question: str, snapshot: dict[str, Any]) -> Optional[str]:
        normalized = question.lower()
        dashboard = snapshot.get("dashboard", {})
        ranking = snapshot.get("risk_ranking", [])
        top = ranking[0] if ranking else {}

        if re.search(r"\boverall risk\b|\brisk score\b", normalized) and "overall" in normalized:
            score = dashboard.get("overall_risk_score")
            level = dashboard.get("overall_risk_level")
            return f"The overall operational risk score is {score}, classified as {level}."

        if re.search(r"\bunresolved\b|\bopen\b", normalized):
            unresolved = dashboard.get("unresolved_complaints")
            total = dashboard.get("total_complaints")
            return f"There are {unresolved} unresolved complaints out of {total} total complaints in the current DSS snapshot."

        if re.search(r"\bhighest risk\b|\btop risk\b|\bmost risk\b", normalized) and top:
            return (
                f"The highest risk category is {top.get('category_name')} with a risk score of "
                f"{top.get('risk_score')} and {top.get('unresolved_count')} unresolved complaints."
            )

        if re.search(r"\blocation\b|\bhotspot\b|\bwhere\b", normalized):
            location = top.get("hotspot_location") or top.get("dominant_location") or dashboard.get("top_hotspot_location")
            if location:
                return f"The strongest location signal in the current briefing is {location}."

        return None