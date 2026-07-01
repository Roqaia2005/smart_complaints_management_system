"""Prompt compiler for assistant dialogue and answers."""

from __future__ import annotations

import json
from typing import Any

from assistant.prompts.templates import (
    ANSWER_SYSTEM_PROMPT,
    ANSWER_USER_TEMPLATE,
    BRIEFING_SYSTEM_PROMPT,
    BRIEFING_USER_TEMPLATE,
)


class PromptBuilder:
    """Builds Groq-ready prompt strings from sliced DSS context."""

    def build_briefing_turn_prompt(
        self,
        agenda_step: dict[str, Any],
        context_slice: dict[str, Any],
    ) -> tuple[str, str]:
        user_prompt = BRIEFING_USER_TEMPLATE.format(
            agenda_step=json.dumps(agenda_step, default=str, ensure_ascii=True),
            context=json.dumps(context_slice, default=str, ensure_ascii=True),
        )
        return BRIEFING_SYSTEM_PROMPT.strip(), user_prompt.strip()

    def build_answer_prompt(
        self,
        state: dict[str, Any],
        context_slice: dict[str, Any],
        question: str,
    ) -> tuple[str, str]:
        user_prompt = ANSWER_USER_TEMPLATE.format(
            state=json.dumps(state, default=str, ensure_ascii=True),
            context=json.dumps(context_slice, default=str, ensure_ascii=True),
            question=question.strip(),
        )
        return ANSWER_SYSTEM_PROMPT.strip(), user_prompt.strip()
