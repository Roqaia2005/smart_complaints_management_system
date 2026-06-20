from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from config.database import get_db
from models.schemas import StartSessionRequest, SendMessageRequest, SessionResponse, MessageResponse
from services.chat_service import (
    create_session, save_message, get_history, close_session,
    validate_session, set_session_language, update_collected_state
)
from services.category_service import get_categories_with_keywords, get_assigned_officer
from services.complaint_service import create_complaint, get_sla_hours
from services.groq_client import (
    build_system_prompt, chat_with_groq, detect_language,
    assign_priority, generate_summary, reply_contains_question
)
from services.similarity_service import find_similar_open_complaint, suggest_solutions

router = APIRouter(prefix="/chat", tags=["chat"])


def build_problem_text(problem_summary: str, details: dict) -> str:
    # Flatten details into one readable string for storage and similarity matching
    detail_parts = ", ".join(f"{k}: {v}" for k, v in details.items() if v)
    if detail_parts:
        return f"{problem_summary} ({detail_parts})"
    return problem_summary


def has_minimum_data(state: dict) -> bool:
    # Sanity floor only - the real completeness signal is reply_contains_question
    return bool(state.get("category_id")) and bool(state.get("problem_summary"))


@router.post("/session", response_model=SessionResponse)
async def start_session(body: StartSessionRequest, db: AsyncSession = Depends(get_db)):
    session_id = await create_session(db, body.user_id)
    return SessionResponse(session_id=session_id, message="Session started. How can I help you today?")


@router.post("/message", response_model=MessageResponse)
async def send_message(body: SendMessageRequest, db: AsyncSession = Depends(get_db)):
    session = await validate_session(db, body.session_id, body.user_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found or already closed.")

    history = await get_history(db, body.session_id)
    state = session["state"]

    if not history:
        language = detect_language(body.message)
        await set_session_language(db, body.session_id, language)
    else:
        language = session["language"]

    categories = await get_categories_with_keywords(db)

    search_text = f"{state.get('problem_summary') or ''} {body.message}".strip()
    suggestions = []
    guessed_category = state.get("category_id") or next(
        (c["id"] for c in categories if any(k.lower() in body.message.lower() for k in c["keywords"])),
        None
    )
    if guessed_category:
        suggestions = await suggest_solutions(guessed_category, search_text)

    system_prompt = build_system_prompt(categories, language, suggestions)

    await save_message(db, body.session_id, "user", body.message)
    result = chat_with_groq(system_prompt, history, body.message)

    reply = result.get("reply", "")

    # Category is locked once set - prevents later messages from silently reclassifying it
    if not state.get("category_id") and result.get("category_id"):
        state["category_id"] = result["category_id"]
        state["category_name"] = result["category_name"]

    if result.get("problem_summary"):
        state["problem_summary"] = result["problem_summary"]
    incoming_details = result.get("details", {}) or {}
    state["details"] = {**state.get("details", {}), **{k: v for k, v in incoming_details.items() if v}}

    await update_collected_state(db, body.session_id, state)
    await save_message(db, body.session_id, "assistant", reply)

    # Completion is decided in code: minimum data exists AND the reply asked no more questions
    still_asking = reply_contains_question(reply, language)
    ready = has_minimum_data(state) and not still_asking

    if ready:
        category_id = state["category_id"]
        problem_text = build_problem_text(state["problem_summary"], state["details"])

        if category_id is not None:
            category_id = int(category_id)
        similar = await find_similar_open_complaint(db, body.user_id, category_id, problem_text)

        if similar:
            await close_session(db, body.session_id)
            if similar["status"] == "resolved":
                msg = (
                    f"This appears similar to a previous complaint of yours that was already resolved "
                    f"(ID {similar['complaint_id']}). Please check it on your complaints page - if you "
                    "are not satisfied, you can submit an appeal there."
                ) if language == "en" else (
                    f"يبدو أن هذه الشكوى مشابهة لشكوى سابقة تم حلها بالفعل (رقم {similar['complaint_id']}). "
                    "يمكنك مراجعتها في صفحة شكاواك، وإذا لم يكن الحل مرضياً يمكنك تقديم تظلم."
                )
            else:
                msg = (
                    f"You already have a similar complaint being processed (ID {similar['complaint_id']}, "
                    f"status: {similar['status']}). No need to submit again."
                ) if language == "en" else (
                    f"لديك بالفعل شكوى مشابهة قيد المعالجة (رقم {similar['complaint_id']}، الحالة: {similar['status']}). "
                    "لا داعي لتقديم شكوى جديدة."
                )
            return MessageResponse(reply=msg, complaint_ready=False, collected_data=None)

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

        await close_session(db, body.session_id)

        final_msg = (
            f"Your complaint has been submitted successfully. Reference ID: {complaint_id}."
        ) if language == "en" else (
            f"تم تقديم شكواك بنجاح. رقم الشكوى: {complaint_id}."
        )

        return MessageResponse(reply=f"{reply} {final_msg}", complaint_ready=True, collected_data=state)

    return MessageResponse(reply=reply, complaint_ready=False, collected_data=state)
