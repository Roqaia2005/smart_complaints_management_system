from groq import Groq
from typing import Any, cast
from dotenv import load_dotenv
import os
import json
import logging

load_dotenv()
logger = logging.getLogger("chat_service")

client = Groq(api_key=os.getenv("GROQ_API_KEY"))
MODEL  = os.getenv("GROQ_MODEL", "llama-3.1-8b-instant")


async def reroute_complaint(problem: str, categories: list[dict]) -> dict:
    """
    Given a complaint text and a list of active non-Other categories,
    returns the best matching category or null if no confident match found.
    categories: list of { id, name, keywords }
    returns: { rerouted: bool, category_id: int|None, category_name: str|None }
    """
    if not categories:
        return {"rerouted": False, "category_id": None, "category_name": None}

    category_list = "\n".join(
        f"- ID {c['id']}: {c['name']} | keywords: {', '.join(c.get('keywords', []))}"
        for c in categories
    )

    prompt = f"""A student submitted a complaint that was categorized as "Other" because they could not find the right category.

Complaint text:
"{problem}"

Available categories:
{category_list}

Your task: decide which category best fits this complaint.
If one category clearly fits, return its ID.
If no category fits well, return null.

Respond ONLY with valid JSON in this exact format, no text outside it:
{{
  "category_id": <number or null>,
  "category_name": "<name or null>",
  "confidence": "<high|medium|low>"
}}"""

    try:
        response = client.chat.completions.create(
            model=MODEL,
            messages=cast(Any, [{"role": "user", "content": prompt}]),
            temperature=0,
            max_tokens=100,
        )
        raw = (response.choices[0].message.content or "").strip()

        if not raw.startswith("{"):
            brace_pos = raw.find("{")
            if brace_pos != -1:
                raw = raw[brace_pos:]

        parsed = json.loads(raw)
        category_id = parsed.get("category_id")
        category_name = parsed.get("category_name")
        confidence = parsed.get("confidence", "low")

        if category_id and confidence in ("high", "medium"):
            matched = next((c for c in categories if c["id"] == category_id), None)
            if matched:
                logger.info(f"Rerouted complaint to category {category_id} ({category_name}) with {confidence} confidence")
                return {"rerouted": True, "category_id": category_id, "category_name": category_name}

        logger.info("Reroute: no confident match found, keeping Other category")
        return {"rerouted": False, "category_id": None, "category_name": None}

    except Exception as e:
        logger.error(f"Reroute LLM call failed: {e}")
        return {"rerouted": False, "category_id": None, "category_name": None}