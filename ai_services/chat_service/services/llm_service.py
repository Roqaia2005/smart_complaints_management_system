"""
llm_service.py  (NEW FILE - replaces reroute_service.py)

Thin Groq wrapper. Unlike the old reroute_service.py, this NEVER receives
the full category table -- only the top-3 semantically similar candidates
that category_classifier.py already narrowed things down to. It returns
just a category id (or None), and is passed into CategoryClassifier as
the `llm_chooser` callback.

Delete the old reroute_service.py once this is wired in.
"""

from __future__ import annotations

import json
import logging
import os
from typing import Any, Optional, cast

from dotenv import load_dotenv
from groq import Groq

from services.category_classifier import CategoryCandidate

load_dotenv()
logger = logging.getLogger("llm_service")

client = Groq(api_key=os.getenv("GROQ_API_KEY"))
MODEL = os.getenv("GROQ_MODEL", "llama-3.1-8b-instant")


async def choose_category(problem: str, candidates: list[CategoryCandidate]) -> Optional[int]:
    """
    Given a complaint and a short list (<=3) of semantically similar
    categories, ask the LLM to pick the best one, or return None.
    This is the ONLY place in the system where the LLM sees category data,
    and it only ever sees these pre-filtered candidates.
    """
    if not candidates:
        return None

    candidate_list = "\n".join(
        f"- ID {c.id}: {c.name} | description: {c.description or 'N/A'} "
        f"(semantic similarity: {c.similarity:.2f})"
        for c in candidates
    )

    prompt = f"""A student submitted a complaint. Semantic search already narrowed the
possible categories down to these {len(candidates)} candidates.

Complaint text:
"{problem}"

Candidate categories:
{candidate_list}

Your task: pick the ID of the category that best fits this complaint.
If none of these candidates genuinely fit, return null.

Respond ONLY with valid JSON in this exact format, no text outside it:
{{
  "category_id": <number or null>,
  "confidence": "<high|medium|low>"
}}"""

    try:
        response = client.chat.completions.create(
            model=MODEL,
            messages=cast(Any, [{"role": "user", "content": prompt}]),
            temperature=0,
            max_tokens=60,
        )
        raw = (response.choices[0].message.content or "").strip()

        if not raw.startswith("{"):
            brace_pos = raw.find("{")
            if brace_pos != -1:
                raw = raw[brace_pos:]

        parsed = json.loads(raw)
        category_id = parsed.get("category_id")
        confidence = parsed.get("confidence", "low")

        if category_id and confidence in ("high", "medium"):
            if any(c.id == category_id for c in candidates):
                logger.info(f"LLM chose category {category_id} ({confidence} confidence)")
                return category_id

        logger.info("LLM: no confident match among candidates")
        return None

    except Exception as e:
        logger.error(f"LLM choose_category call failed: {e}")
        return None
