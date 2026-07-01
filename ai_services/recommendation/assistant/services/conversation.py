"""Groq-backed conversation manager for assistant dialogue."""

from __future__ import annotations

import json
import logging
import os
from typing import Any, Optional

from groq import Groq

from assistant.config import GROQ_MODEL, GROQ_TIMEOUT_SECONDS
from assistant.schemas import DialogueSegment

logger = logging.getLogger(__name__)

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
DEFAULT_GROQ_MODEL = os.getenv("GROQ_MODEL", GROQ_MODEL)


class ConversationManager:
    """Handles LLM calls and schema-oriented response normalization."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: str = DEFAULT_GROQ_MODEL,
        timeout_seconds: int = GROQ_TIMEOUT_SECONDS,
    ) -> None:
        self.api_key = api_key if api_key is not None else GROQ_API_KEY
        self.model = model
        self.timeout_seconds = timeout_seconds

    def generate_dialogue_turn(
        self,
        index: int,
        expected_speaker: str,
        system_prompt: str,
        user_prompt: str,
        fallback_text: str,
        fallback_topic: str,
        risk_score: Optional[float] = None,
        recommendation: Optional[str] = None,
    ) -> DialogueSegment:
        payload = self._call_json(system_prompt, user_prompt)
        if not payload:
            payload = {}

        speaker = payload.get("speaker") if payload.get("speaker") in {"host", "analyst"} else expected_speaker
        text = str(payload.get("text") or fallback_text).strip()
        topic = str(payload.get("topic") or fallback_topic).strip()

        return DialogueSegment(
            index=index,
            speaker=speaker,
            text=text,
            audio_url=None,
            topic=topic,
            risk_score=payload.get("risk_score", risk_score),
            recommendation=payload.get("recommendation", recommendation),
        )

    def answer_question(
        self,
        system_prompt: str,
        user_prompt: str,
        fallback_answer: str,
    ) -> tuple[str, list[str]]:
        payload = self._call_json(system_prompt, user_prompt)
        if not payload:
            return fallback_answer, []

        answer = str(payload.get("answer") or fallback_answer).strip()
        suggested = payload.get("suggested_questions")
        if not isinstance(suggested, list):
            suggested = []
        return answer, [str(item) for item in suggested[:5]]

    def _call_json(self, system_prompt: str, user_prompt: str) -> Optional[dict[str, Any]]:
        if not self.api_key:
            logger.warning("GROQ_API_KEY is not configured; using fallback conversation text")
            return None

        try:
            client = Groq(api_key=self.api_key, timeout=self.timeout_seconds)
            response = client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=0,
                response_format={"type": "json_object"},
                max_tokens=700,
            )
            raw = response.choices[0].message.content or ""
            return self._parse_json(raw)
        except Exception as exc:
            logger.exception("Assistant Groq call failed: %s", exc)
            return None

    @staticmethod
    def _parse_json(raw: str) -> Optional[dict[str, Any]]:
        if not raw:
            return None

        text = raw.strip()

        if text.startswith("```"):
            parts = text.split("```")
            text = parts[1] if len(parts) > 1 else text
            if text.strip().lower().startswith("json"):
                text = text.strip()[4:]
            text = text.strip()

        if not text:
            return None

        if text.startswith("{") or text.startswith("["):
            candidate = text
        else:
            start = text.find("{")
            end = text.rfind("}")
            if start != -1 and end != -1 and end > start:
                candidate = text[start : end + 1]
            else:
                candidate = text

        try:
            parsed = json.loads(candidate.strip())
            return parsed if isinstance(parsed, dict) else None
        except json.JSONDecodeError:
            logger.warning("Assistant Groq response was not valid JSON")
            return None
