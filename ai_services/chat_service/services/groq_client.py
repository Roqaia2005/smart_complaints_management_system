from groq import Groq
from dotenv import load_dotenv
from typing import Any, cast
import os
import json
import logging

from services.prompt import build_system_prompt

load_dotenv()
logger = logging.getLogger("chat_service")

client = Groq(api_key=os.getenv("GROQ_API_KEY"))
MODEL  = os.getenv("GROQ_MODEL", "llama-3.1-8b-instant")

FALLBACK_EN = "Sorry, I'm having trouble responding right now. Please try again."
FALLBACK_AR = "عذراً، أواجه مشكلة في الرد الآن. يرجى إعادة إرسال رسالتك."


def detect_language(text: str) -> str:
    arabic = sum(1 for c in text if '\u0600' <= c <= '\u06FF')
    return "ar" if arabic > len(text) * 0.2 else "en"


def reply_contains_question(reply: str) -> bool:
    return "?" in reply or "؟" in reply


def _empty(reply: str) -> dict:
    return {
        "reply": reply,
        "category_id": None,
        "category_name": None,
        "problem_summary": None,
        "details": {},
    }


def chat_with_groq(system_prompt: str, history: list[dict], user_message: str, language: str = "en") -> dict:
    messages: list[Any] = [{"role": "system", "content": system_prompt}]
    messages.extend(history)
    messages.append({"role": "user", "content": user_message})

    try:
        response = client.chat.completions.create(
            model=MODEL,
            messages=cast(Any, messages),
            temperature=0.2,
            max_tokens=1000,
        )
    except Exception as e:
        logger.error(f"Groq call failed: {e}")
        return _empty(FALLBACK_AR if language == "ar" else FALLBACK_EN)

    content = response.choices[0].message.content
    raw = content.strip() if isinstance(content, str) else ""

    if raw.startswith("```"):
        parts = raw.split("```")
        raw = parts[1] if len(parts) > 1 else raw
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.strip()

    if not raw.startswith("{"):
        brace_pos = raw.find("{")
        if brace_pos != -1:
            raw = raw[brace_pos:]

    try:
        parsed = json.loads(raw)
        if not isinstance(parsed.get("details"), dict):
            parsed["details"] = {}
        return parsed
    except json.JSONDecodeError:
        logger.warning("Groq returned non-JSON")
        return _empty(raw)


def assign_priority(category_name: str, problem_summary: str, details: dict, language: str) -> int:
    prompt = f"""Assign priority 1-5 for a university complaint.
1=minor inconvenience  2=comfort issue  3=admin or academic delay  4=urgent academic impact  5=safety or exam risk
Category: {category_name}
Summary: {problem_summary}
Details: {json.dumps(details, ensure_ascii=False)}
Reply with ONLY a single digit 1-5."""

    try:
        r = client.chat.completions.create(
            model=MODEL,
            messages=cast(Any, [{"role": "user", "content": prompt}]),
            temperature=0,
            max_tokens=5,
        )
        raw = (r.choices[0].message.content or "").strip()
        digits = [c for c in raw if c.isdigit()]
        return int(digits[0]) if digits else 3
    except Exception as e:
        logger.error(f"Priority failed: {e}")
        return 3


def generate_summary(
    category_name: str,
    problem_summary: str,
    details: dict,
    language: str,
    student_info: dict | None = None,
) -> str:
    ctx = [
        f"Category: {category_name}",
        f"Summary: {problem_summary}",
        f"Details: {json.dumps(details, ensure_ascii=False)}",
    ]
    if student_info:
        if student_info.get("department"):    ctx.append(f"Student department: {student_info['department']}")
        if student_info.get("academic_year"): ctx.append(f"Student academic year: {student_info['academic_year']}")

    prompt = (
        f"Write a professional complaint summary in {'Arabic' if language == 'ar' else 'English'} "
        f"for a university officer. 2-3 sentences max. "
        f"Include student department and academic year if provided. "
        f"Do not include the student name or ID number.\n\n"
        + "\n".join(ctx)
    )

    try:
        r = client.chat.completions.create(
            model=MODEL,
            messages=cast(Any, [{"role": "user", "content": prompt}]),
            temperature=0.3,
            max_tokens=200,
        )
        raw = r.choices[0].message.content
        return raw.strip() if raw else problem_summary
    except Exception as e:
        logger.error(f"Summary failed: {e}")
        return problem_summary