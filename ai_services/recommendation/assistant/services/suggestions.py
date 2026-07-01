"""
Target path: assistant/services/suggestions.py  (NEW FILE)

Single source of truth for "suggested questions".

WHY THIS EXISTS
----------------
Before this fix there were TWO separate, drifting implementations:
  - IntentRouter._suggested_questions()  (router.py)   -- generic, 5 static-style questions
  - _suggested_questions()               (routes.py)   -- the better "executive style" set

Since IntentRouter.answer() falls back to its own version whenever the
LLM doesn't return its own `suggested_questions`, users would
inconsistently see generic questions after an interruption ("/ask") even
though the initial briefing showed the better executive-style ones from
arch.md's wishlist. This module is now the only place that logic lives;
both router.py and routes.py import it.
"""

from __future__ import annotations

from typing import Any


def build_suggested_questions(snapshot: dict[str, Any]) -> list[str]:
    ranking = snapshot.get("risk_ranking", [])
    top = ranking[0] if ranking else {}
    category = top.get("category_name", "the top category")
    alerts = snapshot.get("alerts", [])
    recommendations = snapshot.get("recommendations", [])

    questions = [
        f"Why did {category} become the highest risk category?",
        "What departments are contributing most to this trend?",
        "Show me the complaint trend over the last month.",
        "What will happen if no action is taken?",
    ]

    if recommendations:
        questions.append("Which recommendation has the greatest impact?")

    if alerts:
        questions.append("Which alerts require immediate executive attention?")

    questions.extend(
        [
            "How has SLA compliance changed this month?",
            "Compare this semester with last semester.",
        ]
    )

    return questions[:5]