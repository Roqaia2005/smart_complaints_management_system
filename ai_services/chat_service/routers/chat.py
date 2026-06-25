from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
import logging

from config.database import get_db
from models.schemas import StartSessionRequest, SendMessageRequest, SessionResponse, MessageResponse
from services.chat_service import (
    create_session, save_message, get_history, close_session,
    validate_session, set_session_language, update_collected_state,
    count_messages
)
from services.category_service import get_categories_with_keywords, get_assigned_officer
from services.complaint_service import create_complaint, get_sla_hours, attach_file
from services.groq_client import (
    build_system_prompt, chat_with_groq, detect_language,
    assign_priority, generate_summary, reply_contains_question
)
from services.similarity_service import find_similar_open_complaint, suggest_solutions

logger = logging.getLogger("chat_service")

router = APIRouter(prefix="/chat", tags=["chat"])

MAX_MESSAGES_PER_SESSION = 20

LIMIT_REACHED_EN = (
    "This conversation has reached its message limit. Please contact support directly, "
    "or start a new conversation to submit a different complaint."
)
LIMIT_REACHED_AR = (
    "وصلت هذه المحادثة إلى الحد الأقصى للرسائل. يرجى التواصل مع الدعم مباشرة، "
    "أو بدء محادثة جديدة لتقديم شكوى مختلفة."
)

ACCEPT_WORDS_EN = {"yes", "yeah", "yep", "worked", "solved", "resolved", "thanks", "fixed", "got it", "that works"}
ACCEPT_WORDS_AR = {"نعم", "ايوه", "أيوه", "تمام", "اتحل", "حل", "شغال", "اشتغل", "شكرا", "شكراً"}

DECLINE_WORDS_EN = {"no", "not", "didn't", "doesn't", "still", "submit", "go ahead", "file it"}
DECLINE_WORDS_AR = {"لا", "مش", "لسه", "ابعت", "قدم", "سجل"}


def build_problem_text(problem_summary: str, details: dict) -> str:
    detail_parts = ", ".join(f"{k}: {v}" for k, v in details.items() if v)
    if detail_parts:
        return f"{problem_summary} ({detail_parts})"
    return problem_summary


def has_minimum_data(state: dict) -> bool:
    return bool(state.get("category_id")) and bool(state.get("problem_summary"))


def looks_like_acceptance(message: str, language: str) -> bool:
    text = message.strip().lower()
    decline_words = DECLINE_WORDS_AR if language == "ar" else DECLINE_WORDS_EN
    if any(w in text for w in decline_words):
        return False
    accept_words = ACCEPT_WORDS_AR if language == "ar" else ACCEPT_WORDS_EN
    return any(w in text for w in accept_words)


@router.post("/session", response_model=SessionResponse)
async def start_session(body: StartSessionRequest, db: AsyncSession = Depends(get_db)):
    session_id = await create_session(db, body.user_id)
    return SessionResponse(session_id=session_id, message="Session started. How can I help you today?")


@router.post("/message", response_model=MessageResponse)
async def send_message(body: SendMessageRequest, db: AsyncSession = Depends(get_db)):
    session = await validate_session(db, body.session_id, body.user_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found or already closed.")

    message_count = await count_messages(db, body.session_id)
    if message_count >= MAX_MESSAGES_PER_SESSION:
        await close_session(db, body.session_id, status="abandoned")
        limit_msg = LIMIT_REACHED_AR if session["language"] == "ar" else LIMIT_REACHED_EN
        return MessageResponse(reply=limit_msg, complaint_ready=False, collected_data=None)

    history = await get_history(db, body.session_id)
    state = session["state"]

    if not history:
        language = detect_language(body.message)
        await set_session_language(db, body.session_id, language)
    else:
        language = session["language"]

    # If a suggestion was offered last turn, handle accept/decline here in code -
    # never let this fall through to the normal submission pipeline
    if state.get("suggestion_offered"):
        if looks_like_acceptance(body.message, language):
            await save_message(db, body.session_id, "user", body.message)
            closing = (
                "Glad that solved it! Let us know if you need anything else."
            ) if language == "en" else (
                "يسعدني أن هذا حل المشكلة! تواصل معنا إذا احتجت أي شيء آخر."
            )
            await save_message(db, body.session_id, "assistant", closing)
            await close_session(db, body.session_id)
            return MessageResponse(reply=closing, complaint_ready=False, complaint_id=None, collected_data=None)
        else:
            # Student declined the suggestion or asked to proceed - clear the flag
            # and continue normally into the regular collection/submission flow below
            state["suggestion_offered"] = False

    categories = await get_categories_with_keywords(db)

    search_text = f"{state.get('problem_summary') or ''} {body.message}".strip()
    suggestions = []
    guessed_category = state.get("category_id") or next(
        (c["id"] for c in categories if any(k.lower() in body.message.lower() for k in c["keywords"])),
        None
    )
    if guessed_category:
        suggestions = await suggest_solutions(guessed_category, search_text)

    system_prompt = build_system_prompt(categories, language, suggestions, state)

    await save_message(db, body.session_id, "user", body.message)
    result = chat_with_groq(system_prompt, history, body.message, language)

    reply = result.get("reply", "")

    if not state.get("category_id") and result.get("category_id"):
        state["category_id"] = result["category_id"]
        state["category_name"] = result["category_name"]

    if result.get("problem_summary"):
        state["problem_summary"] = result["problem_summary"]
    incoming_details = result.get("details", {}) or {}
    state["details"] = {**state.get("details", {}), **{k: v for k, v in incoming_details.items() if v}}

    # Mark that this turn offered a suggestion, so the NEXT message is interpreted
    # as accept/decline rather than fed into the normal collection pipeline
    state["suggestion_offered"] = bool(suggestions) and reply_contains_question(reply)

    await update_collected_state(db, body.session_id, state)
    await save_message(db, body.session_id, "assistant", reply)

    if state["suggestion_offered"]:
        return MessageResponse(reply=reply, complaint_ready=False, complaint_id=None, collected_data=state)

    still_asking = reply_contains_question(reply)
    ready = has_minimum_data(state) and not still_asking

    if ready:
        category_id = state["category_id"]
        problem_text = build_problem_text(state["problem_summary"], state["details"])

        similar = await find_similar_open_complaint(db, body.user_id, category_id, problem_text)

        if similar:
            await close_session(db, body.session_id)
            if similar["status"] == "resolved":
                msg = (
                    "This appears similar to a previous complaint of yours that was already resolved. "
                    "Please check your complaints page - if you are not satisfied, you can submit an appeal there."
                ) if language == "en" else (
                    "يبدو أن هذه الشكوى مشابهة لشكوى سابقة تم حلها بالفعل. "
                    "يمكنك مراجعتها في صفحة شكاواك، وإذا لم يكن الحل مرضياً يمكنك تقديم تظلم."
                )
            else:
                msg = (
                    "You already have a similar complaint being processed. No need to submit again."
                ) if language == "en" else (
                    "لديك بالفعل شكوى مشابهة قيد المعالجة. لا داعي لتقديم شكوى جديدة."
                )
            return MessageResponse(
                reply=msg, complaint_ready=False,
                complaint_id=similar["complaint_id"], collected_data=None
            )

        priority = assign_priority(state["category_name"], state["problem_summary"], state["details"], language)
        officer_id = await get_assigned_officer(db, category_id)
        sla_hours = await get_sla_hours(db, category_id)
        ai_summary = generate_summary(state["category_name"], state["problem_summary"], state["details"], language)

        complaint_id = await create_complaint(
            db=db,
            user_id=body.user_id,
            category_id=category_id,
            problem=problem_text,
            location=state["details"].get("location", ""),
            since=state["details"].get("since", ""),
            ai_summary=ai_summary,
            priority=priority,
            assigned_officer_id=officer_id,
            sla_hours=sla_hours
        )

        if body.attachment_url:
            await attach_file(db, complaint_id, body.attachment_url)

        await close_session(db, body.session_id)
        logger.info(f"Complaint {complaint_id} submitted for user {body.user_id}, category {category_id}")

        return MessageResponse(
            reply=reply, complaint_ready=True,
            complaint_id=complaint_id, collected_data=state
        )

    return MessageResponse(reply=reply, complaint_ready=False, collected_data=state)