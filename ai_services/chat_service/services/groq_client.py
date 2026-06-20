from groq import Groq
from dotenv import load_dotenv
from typing import Any, cast
import os
import json

load_dotenv()

client = Groq(api_key=os.getenv("GROQ_API_KEY"))
MODEL = os.getenv("GROQ_MODEL", "llama-3.1-8b-instant")


def build_system_prompt(
    categories: list[dict],
    language: str,
    suggestions: list[dict]
) -> str:
    lang_instruction = (
        "You MUST respond only in Arabic. Do not use any English words."
        if language == "ar"
        else "You MUST respond only in English. Do not use any Arabic words."
    )

    category_block = "\n".join(
        f"- ID {c['id']}: {c['name']} | keywords: {', '.join(c['keywords'])}"
        for c in categories
    )

    suggestion_block = ""
    if suggestions:
        items = "\n".join(f"- {s['resolution']}" for s in suggestions)
        suggestion_block = f"""
A similar resolved complaint was found. Its solution was:
{items}
If this genuinely answers the student's problem, offer it: "A similar issue was resolved before with: [solution]. Does this solve your issue, or would you like to formally submit?"
Only offer it if it is a real fix the student could apply themselves (e.g. a workaround, a link, an alternative process).
Do NOT offer it if the past resolution was specific to that other case only (e.g. a grade correction, a personal disciplinary outcome, an individual exception) - those cannot help a different student.
If unsure, do not offer it - just proceed with collecting information normally.
"""

    return f"""You are a university complaint assistant for Cairo University.
LANGUAGE RULE: {lang_instruction}
This rule overrides everything. Never mix languages.

Your job: have a natural conversation with the student to understand their complaint, then prepare it for submission.
Refuse any complaint unrelated to university life politely.

AVAILABLE CATEGORIES:
{category_block}
{suggestion_block}

HOW TO COLLECT INFORMATION - THINK LIKE A HUMAN OFFICER, NOT A FORM:
Different complaints need different details. Decide what is actually relevant based on the type of complaint:
- A facility problem (AC, internet, equipment) needs: where it is, AND since when. Both are required before you are done.
- A complaint about a person (doctor, staff member, employee) needs: who it is (name or course/department) AND what happened. Both are required before you are done.
- An academic issue (grades, exam, registration) needs: course name AND what specifically is wrong. Both are required before you are done.
Only ask for details that make sense for THIS specific complaint type - never ask for a "location" on a people complaint, never ask for a "person's name" on a facility complaint.
Ask ONE question at a time.
- Don't ask many questions overall as just gather the necessary information that will help the officer 

CRITICAL RULE ABOUT YOUR REPLY TEXT:
- If you still need any required piece of information, your "reply" MUST contain a question asking for it. Do not make a statement when you still need information - always phrase it as a question.
- If and only if you have every required piece of information for this complaint type, your "reply" MUST NOT contain any question. Write a short closing statement only, such as "Got it, submitting your complaint now." or its Arabic equivalent.
- Never mix the two: never ask a question AND act like you are done in the same reply.

WHAT YOU MUST NEVER ASK THE STUDENT:
- Never ask the student to choose a category or give a category ID - you determine this yourself from their words.
- Never ask the student what priority level their complaint is - you determine this yourself.
- Never ask for information that does not apply to their type of complaint.
- Never ask for personal information or student information because it already present in the system

HOW TO PHRASE QUESTIONS:
- Make clear the answer matters for getting their complaint handled properly - e.g. "To make sure the right team can act on this, could you tell me..." rather than a flat, optional-sounding question.
- Keep it natural and brief - one short sentence of context plus the question, not a lecture.


WHAT YOU MUST NEVER MENTION IN YOUR REPLY:
- Never mention complaint IDs, reference numbers, database fields, category IDs, internal statuses, or any system/technical detail. The system adds reference numbers separately after you respond - you must never include or guess one yourself.
- Never say things like "ticket", "record", "field", "category ID", or similar technical language. Speak the way a helpful human officer would.

RESPONSE FORMAT - respond ONLY with this exact JSON structure, no text outside it:
{{
  "reply": "your message to the student",
  "category_id": null,
  "category_name": null,
  "problem_summary": null,
  "details": {{}}
}}

FIELD RULES:
- category_id / category_name: fill these in as soon as you can tell from the conversation. Use the exact ID from the list above.
- problem_summary: a one-sentence description of the core issue, fill in as soon as known.
- details: a flexible object - put whatever relevant facts you gathered here using sensible keys (e.g. "location", "since", "person_name", "course_name" - whatever fits this complaint). Keep updating it as you learn more, never remove a key once set.
"""


def detect_language(text: str) -> str:
    arabic_chars = sum(1 for c in text if '\u0600' <= c <= '\u06FF')
    return "ar" if arabic_chars > len(text) * 0.2 else "en"


def reply_contains_question(reply: str, language: str) -> bool:
    # Detect if the model is still asking for something, regardless of what it claims
    if "?" in reply or "؟" in reply:
        return True
    return False


def chat_with_groq(system_prompt: str, history: list[dict], user_message: str) -> dict:
    messages: list[Any] = [{"role": "system", "content": system_prompt}]
    messages.extend(history)
    messages.append({"role": "user", "content": user_message})

    response = client.chat.completions.create(
        model=MODEL,
        messages=cast(Any, messages),
        temperature=0.2,
        max_tokens=1000,
    )

    content = response.choices[0].message.content
    raw = content.strip() if isinstance(content, str) else ""

    if raw.startswith("```"):
        parts = raw.split("```")
        raw = parts[1] if len(parts) > 1 else raw
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.strip()

    try:
        parsed = json.loads(raw)
        if "details" not in parsed or parsed["details"] is None:
            parsed["details"] = {}
        return parsed
    except json.JSONDecodeError:
        return {
            "reply": raw,
            "category_id": None,
            "category_name": None,
            "problem_summary": None,
            "details": {}
        }


def assign_priority(category_name: str, problem_summary: str, details: dict, language: str) -> int:
    prompt = f"""You are assigning a priority level 1-5 for a university complaint.
1 = minor inconvenience, no academic impact
2 = service issue affecting comfort, not academics
3 = administrative/academic issue causing delay
4 = urgent issue directly affecting academic progress
5 = safety risk or exam disruption

Category: {category_name}
Summary: {problem_summary}
Details: {json.dumps(details, ensure_ascii=False)}

Respond with ONLY a single digit 1-5, nothing else."""

    response = client.chat.completions.create(
        model=MODEL,
        messages=cast(Any, [{"role": "user", "content": prompt}]),
        temperature=0,
        max_tokens=5,
    )

    raw = response.choices[0].message.content
    if raw is None:
        return 3
    raw = raw.strip()
    digits = [c for c in raw if c.isdigit()]
    return int(digits[0]) if digits else 3


def generate_summary(category_name: str, problem_summary: str, details: dict, language: str) -> str:
    prompt = (
        f"Write a professional complaint summary in {'Arabic' if language == 'ar' else 'English'} "
        f"for a university officer. Be concise, 2-3 sentences max. "
        f"Category: {category_name}, Summary: {problem_summary}, "
        f"Details: {json.dumps(details, ensure_ascii=False)}. "
        f"Do not include student name or ID."
    )

    response = client.chat.completions.create(
        model=MODEL,
        messages=cast(Any, [{"role": "user", "content": prompt}]),
        temperature=0.3,
        max_tokens=200,
    )
    raw = response.choices[0].message.content
    return raw.strip() if raw is not None else ""