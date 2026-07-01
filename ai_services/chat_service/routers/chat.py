from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from better_profanity import profanity
import logging

from config.database import get_db
from config.chroma import chroma_client
from models.schemas import StartSessionRequest, SendMessageRequest, SessionResponse, MessageResponse
from services.chat_service import (
    create_session, save_message, get_history, close_session,
    validate_session, set_session_language, update_collected_state,
    count_messages, get_student_info, get_student_faculty_id, log_offensive_incident,
)
from services.category_service import get_categories_with_keywords, get_assigned_officer
from services.complaint_service import create_complaint, get_sla_hours, attach_file
from services.groq_client import (
    build_system_prompt, chat_with_groq, detect_language,
    assign_priority, generate_summary, reply_contains_question,
)
from services.similarity_service import find_similar_open_complaint, suggest_solutions
from services.regulation_service import get_relevant_regulations

logger = logging.getLogger("chat_service")
router = APIRouter(prefix="/chat", tags=["chat"])

# English offensive words handled by better_profanity built-in list
profanity.load_censor_words()

# Arabic offensive words checked separately since better_profanity does not handle Arabic reliably
_ARABIC_OFFENSIVE = {
    "غبي", "حمار", "كلب", "وسخ", "زبالة", "متخلف",
    "بهيم", "تيس", "عرص", "منيوك", "احا", "زفت",
    "كس", "نيك", "شرموط", "عيل",
}

MAX_MESSAGES  = 20
MAX_OFFENSIVE = 2

LIMIT_EN   = "This conversation has reached its message limit. Please start a new conversation to submit a different complaint."
LIMIT_AR   = "وصلت هذه المحادثة إلى الحد الأقصى للرسائل. يرجى بدء محادثة جديدة لتقديم شكوى مختلفة."
BLOCKED_EN = "This conversation has been closed due to offensive language. The administration has been notified."
BLOCKED_AR = "تم إغلاق هذه المحادثة بسبب استخدام ألفاظ مسيئة. تم إبلاغ الإدارة."
WARN_1_EN  = "Please keep this conversation respectful. This has been logged. One more offensive message will close this conversation."
WARN_1_AR  = "يرجى الحفاظ على لغة محترمة. تم تسجيل هذه الرسالة. رسالة مسيئة أخرى ستغلق هذه المحادثة."

SUBMITTED_EN = "Your complaint has been submitted successfully. You can track it from your complaints page."
SUBMITTED_AR = "تم تقديم شكواك بنجاح. يمكنك متابعتها من صفحة الشكاوى."

ACCEPT_EN  = {"yes","yeah","yep","worked","solved","resolved","thanks","fixed","got it","that works","great","ok","okay"}
ACCEPT_AR  = {"نعم","ايوه","أيوه","تمام","اتحل","حل","شغال","اشتغل","شكرا","شكراً","ممتاز","حسناً","اوكي"}
DECLINE_EN = {"no","not","didn't","doesn't","still","submit","go ahead","file it","nope"}
DECLINE_AR = {"لا","مش","لسه","ابعت","قدم","سجل","لأ"}


def _is_offensive(message: str) -> bool:
    # Check English using better_profanity
    if profanity.contains_profanity(message):
        return True
    # Check Arabic by splitting on spaces and checking each word against the set
    words = message.strip().split()
    return any(w in _ARABIC_OFFENSIVE for w in words)


def _build_problem_text(summary: str, details: dict) -> str:
    parts = ", ".join(f"{k}: {v}" for k, v in details.items() if v)
    return f"{summary} ({parts})" if parts else summary


def _has_data(state: dict) -> bool:
    return bool(state.get("category_id")) and bool(state.get("problem_summary"))


def _is_acceptance(message: str, language: str) -> bool:
    t = message.strip().lower()
    if any(w in t for w in (DECLINE_AR if language == "ar" else DECLINE_EN)):
        return False
    return any(w in t for w in (ACCEPT_AR if language == "ar" else ACCEPT_EN))


async def _get_offensive_count(db: AsyncSession, session_id: int) -> int:
    result = await db.execute(
        text('SELECT COUNT(*) AS cnt FROM "OffensiveMessages" WHERE session_id = :sid'),
        {"sid": session_id}
    )
    row = result.fetchone()
    return int(row.cnt) if row else 0


@router.post("/session", response_model=SessionResponse)
async def start_session(body: StartSessionRequest, db: AsyncSession = Depends(get_db)):
    student    = await get_student_info(db, body.user_id)
    session_id = await create_session(db, body.user_id)
    name       = student.get("name", "")
    greeting   = f"Hello {name}! How can I help you today?" if name else "Hello! How can I help you today?"
    return SessionResponse(session_id=session_id, message=greeting)


@router.post("/message", response_model=MessageResponse)
async def send_message(body: SendMessageRequest, db: AsyncSession = Depends(get_db)):

    session = await validate_session(db, body.session_id, body.user_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found or already closed.")

    msg_count = await count_messages(db, body.session_id)
    if msg_count >= MAX_MESSAGES:
        await close_session(db, body.session_id, status="abandoned")
        lang = session["language"]
        return MessageResponse(reply=LIMIT_AR if lang == "ar" else LIMIT_EN, complaint_ready=False, collected_data=None)

    history = await get_history(db, body.session_id)
    state   = session["state"]

    if not history:
        language = detect_language(body.message)
        await set_session_language(db, body.session_id, language)
    else:
        language = session["language"]

    # Offensive check runs before anything else — no API call wasted on offensive messages
    if _is_offensive(body.message):
        warnings_so_far = await _get_offensive_count(db, body.session_id)
        new_count       = warnings_so_far + 1

        await save_message(db, body.session_id, "user", body.message)
        await log_offensive_incident(db, body.user_id, body.session_id, body.message, new_count)
        state["offensive_count"] = new_count
        await update_collected_state(db, body.session_id, state)

        logger.warning(f"Offensive message #{new_count} — user {body.user_id} session {body.session_id}")

        if new_count >= MAX_OFFENSIVE:
            blocked = BLOCKED_AR if language == "ar" else BLOCKED_EN
            await save_message(db, body.session_id, "assistant", blocked)
            await close_session(db, body.session_id, status="abandoned")
            return MessageResponse(reply=blocked, complaint_ready=False, complaint_id=None, collected_data=None)

        warning = WARN_1_AR if language == "ar" else WARN_1_EN
        await save_message(db, body.session_id, "assistant", warning)
        return MessageResponse(reply=warning, complaint_ready=False, complaint_id=None, collected_data=state)

    # Handle suggestion accept/decline before building the prompt
    if state.get("suggestion_offered"):
        if _is_acceptance(body.message, language):
            await save_message(db, body.session_id, "user", body.message)
            closing = "Glad that helped! Let us know if you need anything else." if language == "en" else "يسعدني أن هذا حل المشكلة! تواصل معنا إذا احتجت أي شيء آخر."
            await save_message(db, body.session_id, "assistant", closing)
            await close_session(db, body.session_id)
            return MessageResponse(reply=closing, complaint_ready=False, complaint_id=None, collected_data=None)
        else:
            state["suggestion_offered"] = False

    categories  = await get_categories_with_keywords(db)
    search_text = f"{state.get('problem_summary') or ''} {body.message}".strip()
    guessed_cat = state.get("category_id") or next(
        (c["id"] for c in categories if any(k.lower() in body.message.lower() for k in c["keywords"])),
        None,
    )
    suggestions = await suggest_solutions(guessed_cat, search_text) if guessed_cat else []

    faculty_id  = await get_student_faculty_id(db, body.user_id)
    regulations = []
    if faculty_id:
        try:
            regulations = get_relevant_regulations(search_text, faculty_id, chroma_client)
        except Exception as e:
            logger.warning(f"Regulation retrieval failed: {e}")

    student_info = await get_student_info(db, body.user_id)
    force_close  = state.get("questions_asked", 0) >= 3

    system_prompt = build_system_prompt(
        categories, language, suggestions, state, regulations, student_info,
        force_close=force_close,
    )

    await save_message(db, body.session_id, "user", body.message)
    result = chat_with_groq(system_prompt, history, body.message, language)
    reply  = result.get("reply", "")

    if not state.get("category_id") and result.get("category_id"):
        state["category_id"]   = result["category_id"]
        state["category_name"] = result["category_name"]

    if result.get("problem_summary"):
        state["problem_summary"] = result["problem_summary"]

    incoming = result.get("details") or {}
    state["details"] = {**state.get("details", {}), **{k: v for k, v in incoming.items() if v}}

    if reply_contains_question(reply):
        state["questions_asked"] = state.get("questions_asked", 0) + 1

    state["suggestion_offered"] = bool(suggestions) and reply_contains_question(reply)

    await update_collected_state(db, body.session_id, state)
    await save_message(db, body.session_id, "assistant", reply)

    if state["suggestion_offered"]:
        return MessageResponse(reply=reply, complaint_ready=False, complaint_id=None, collected_data=state)

    ready = _has_data(state) and not reply_contains_question(reply)
    if not ready:
        return MessageResponse(reply=reply, complaint_ready=False, collected_data=state)

    problem_text = _build_problem_text(state["problem_summary"], state["details"])
    similar = await find_similar_open_complaint(db, body.user_id, state["category_id"], problem_text)

    if similar:
        await close_session(db, body.session_id)
        if similar["status"] == "resolved":
            msg = ("This looks like a previously resolved complaint. Check your complaints page — if unsatisfied, you can submit an appeal."
                   if language == "en" else
                   "يبدو أن هذه الشكوى مشابهة لشكوى سابقة تم حلها. راجع صفحة شكاواك، وإذا لم يكن الحل مرضياً يمكنك تقديم تظلم.")
        else:
            msg = ("You already have a similar complaint being processed. No need to submit again."
                   if language == "en" else
                   "لديك بالفعل شكوى مشابهة قيد المعالجة. لا داعي لتقديم شكوى جديدة.")
        return MessageResponse(reply=msg, complaint_ready=False, complaint_id=similar["complaint_id"], collected_data=None)

    priority   = assign_priority(state["category_name"], state["problem_summary"], state["details"], language)
    officer_id = await get_assigned_officer(db, state["category_id"])
    sla_hours  = await get_sla_hours(db, state["category_id"])
    ai_summary = generate_summary(
        state["category_name"], state["problem_summary"],
        state["details"], language, student_info,
    )

    complaint_id = await create_complaint(
        db=db,
        user_id=body.user_id,
        category_id=state["category_id"],
        problem=problem_text,
        location=state["details"].get("location", ""),
        since=state["details"].get("since", ""),
        ai_summary=ai_summary,
        priority=priority,
        assigned_officer_id=officer_id,
        sla_hours=sla_hours,
    )

    if body.attachment_url:
        await attach_file(db, complaint_id, body.attachment_url)

    await close_session(db, body.session_id)
    logger.info(f"Complaint {complaint_id} submitted — user {body.user_id}")

    # Use a hardcoded submission confirmation in the correct language
    # so the student always receives a clear message regardless of what the LLM said
    submission_reply = SUBMITTED_AR if language == "ar" else SUBMITTED_EN

    return MessageResponse(reply=submission_reply, complaint_ready=True, complaint_id=complaint_id, collected_data=state)