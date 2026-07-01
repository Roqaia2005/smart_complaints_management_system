"""
Target path: assistant/routes.py  (REPLACES existing file)

FastAPI routes for the AI Executive Voice Briefing Assistant.

CHANGES IN THIS VERSION
------------------------
1. EVENT-LOOP BLOCKING (the systemic cause of "everything feels laggy",
   not just this one feature): generate_briefing() and ask_question()
   are `async def`, but were calling fully synchronous, slow functions
   directly without awaiting them:
     - build_assistant_analytics_snapshot(db)  -- DB query + Groq
       translation calls + TF-IDF + 10 analytical engines
     - conversation_director.build_script(snapshot)  -- 9 sequential
       blocking Groq calls (now fixed to be async+parallel in director.py,
       see that file's docstring)
     - intent_router.answer(...)  -- a blocking Groq call

   None of FastAPI/Starlette's automatic threadpool offloading applies
   here, because that only happens for routes defined as plain `def`.
   These are `async def`, so every one of those blocking calls was
   freezing the single asyncio event loop -- meaning ALL other
   concurrent requests across the whole app (other users' sessions,
   unrelated DSS calls, health checks) stalled for the full duration.
   Fixed by wrapping the synchronous calls in `asyncio.to_thread(...)`.

2. SEQUENTIAL TTS GENERATION: the loop that generated audio for all 9
   dialogue segments awaited them one at a time. Now generated
   concurrently via asyncio.gather(), since segments are independent.

3. force_refresh WAS NEVER USED: GenerateBriefingRequest.force_refresh
   has existed in schemas.py the whole time but was never read anywhere.
   Now wired through to the (newly cached) snapshot builder.

4. STT errors were unhandled: if all STT providers failed,
   STTProviderManager raised a bare RuntimeError that FastAPI would turn
   into an opaque 500. Now caught and converted to a proper 503 with a
   clear message.

5. Suggested questions: both endpoints now use the single shared
   assistant/services/suggestions.py implementation instead of two
   independently-maintained copies.

6. FACULTY DATA ISOLATION: generate_briefing() now resolves the
   requesting manager's faculty_id and requires it (403 if missing),
   passing it through to the now faculty-scoped
   build_assistant_analytics_snapshot(). Previously the voice assistant
   showed every faculty's complaint data to every manager regardless of
   which faculty they belonged to. See assistant/services/analytics.py
   and dss_routes.py for the matching fix on the DSS dashboard side.
"""

from __future__ import annotations

import asyncio
import logging
import tempfile
from pathlib import Path

from fastapi import APIRouter, Depends, File, Header, HTTPException, UploadFile
from sqlalchemy.orm import Session

from database import get_db
from assistant.providers.edge_tts import EdgeTTSProvider
from assistant.providers.groq_whisper import GroqWhisperProvider
from assistant.providers.kokoro_tts import KokoroTTSProvider
from assistant.schemas import (
    AskQuestionRequest,
    AskQuestionResponse,
    ConversationHistoryItem,
    DialogueSegment,
    EndSessionRequest,
    EndSessionResponse,
    GenerateBriefingRequest,
    GenerateBriefingResponse,
    SessionStatusResponse,
    STTResponse,
)
from assistant.services.analytics import build_assistant_analytics_snapshot
from assistant.services.auth import AuthenticatedUser, authenticate_assistant_user, get_user_faculty_id
from assistant.services.director import ConversationDirector
from assistant.services.router import IntentRouter
from assistant.services.session import (
    SessionManager,
    SessionNotFoundError,
    SessionPermissionError,
    session_manager,
)
from assistant.services.stt_manager import STTProviderManager
from assistant.services.suggestions import build_suggested_questions
from assistant.services.tts_manager import TTSProviderManager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/assistant", tags=["Executive Assistant"])

conversation_director = ConversationDirector()
intent_router = IntentRouter(director=conversation_director)
tts_manager = TTSProviderManager([EdgeTTSProvider(), KokoroTTSProvider()])
stt_manager = STTProviderManager([GroqWhisperProvider()])


@router.post("/generate-briefing", response_model=GenerateBriefingResponse)
async def generate_briefing(
    body: GenerateBriefingRequest,
    db: Session = Depends(get_db),
    authorization: str | None = Header(default=None),
    manager: SessionManager = Depends(lambda: session_manager),
):
    current_user = authenticate_assistant_user(db=db, authorization=authorization)

    # FIX: the voice briefing is faculty-scoped data (same policy as
    # /api/chat/recommendations) -- a manager must belong to a faculty to
    # generate one. Without this, build_assistant_analytics_snapshot's new
    # faculty_id parameter would have nothing to scope by.
    faculty_id = await asyncio.to_thread(get_user_faculty_id, db, current_user.id)
    if not faculty_id:
        raise HTTPException(
            status_code=403,
            detail="User must be assigned to a faculty to generate an executive briefing.",
        )

    # Blocking: DB fetch + Groq translation + TF-IDF + analytical engines.
    # Off the event loop, and now cached (per-faculty) -- see
    # assistant/services/analytics.py.
    snapshot = await asyncio.to_thread(
        build_assistant_analytics_snapshot, db, faculty_id, body.force_refresh
    )

    session = manager.create_session(user_id=current_user.id, analytics_snapshot=snapshot)

    # 9 agenda steps generated concurrently via a thread pool (see director.py).
    dialogue = await conversation_director.build_script(snapshot)

    # Generate audio for all segments concurrently instead of one-at-a-time.
    async def _synthesize(segment: DialogueSegment) -> DialogueSegment:
        segment.audio_url = await tts_manager.generate_audio(segment.text, segment.speaker)
        return segment

    dialogue = list(await asyncio.gather(*[_synthesize(seg) for seg in dialogue]))

    session = manager.save_dialogue(session.session_id, dialogue, user_id=current_user.id, status="ready")
    summary = snapshot.get("executive_summary", {}).get("summary", "Executive briefing is ready.")

    missing_audio = [seg.index for seg in dialogue if not seg.audio_url]
    if missing_audio:
        logger.warning(
            "Briefing %s generated with no audio for segment indices %s "
            "(check TTS provider logs above for the root cause)",
            session.session_id,
            missing_audio,
        )

    return GenerateBriefingResponse(
        session_id=session.session_id,
        summary=summary,
        dialogue=session.dialogue_script,
        suggested_questions=build_suggested_questions(snapshot),
    )


@router.post("/ask", response_model=AskQuestionResponse)
async def ask_question(
    body: AskQuestionRequest,
    db: Session = Depends(get_db),
    authorization: str | None = Header(default=None),
    manager: SessionManager = Depends(lambda: session_manager),
):
    current_user = authenticate_assistant_user(db=db, authorization=authorization)
    try:
        session = manager.update_playback(
            body.session_id,
            body.current_dialogue_index,
            user_id=current_user.id,
            status="answering",
        )
    except SessionNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except SessionPermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc

    active_segment = _active_segment(session.dialogue_script, body.current_dialogue_index)
    state = {
        "session_id": session.session_id,
        "current_dialogue_index": body.current_dialogue_index,
        "active_speaker": active_segment.speaker if active_segment else None,
        "active_topic": active_segment.topic if active_segment else None,
        "conversation_history": [item.model_dump() for item in session.conversation_history[-5:]],
    }

    # Blocking: IntentRouter.answer() makes a synchronous Groq call when the
    # question isn't deterministically answerable from the snapshot.
    answer, suggested = await asyncio.to_thread(
        intent_router.answer, body.question, session.analytics_snapshot, state
    )
    audio_url = await tts_manager.generate_audio(answer, "analyst")

    manager.append_history(
        session.session_id,
        [
            ConversationHistoryItem(speaker="user", text=body.question),
            ConversationHistoryItem(speaker="analyst", text=answer),
        ],
        user_id=current_user.id,
    )
    manager.update_playback(session.session_id, body.current_dialogue_index, user_id=current_user.id, status="paused")

    return AskQuestionResponse(
        answer=answer,
        audio_url=audio_url,
        resume_index=body.current_dialogue_index,
        suggested_questions=suggested,
    )


@router.post("/stt", response_model=STTResponse)
async def transcribe_audio(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    authorization: str | None = Header(default=None),
):
    authenticate_assistant_user(db=db, authorization=authorization)
    suffix = Path(file.filename or "audio.webm").suffix or ".webm"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(await file.read())
        temp_path = tmp.name

    try:
        result = await stt_manager.transcribe_audio(temp_path)
        return STTResponse(
            transcript=result.transcript,
            confidence=result.confidence,
            provider_used=result.provider_used,
        )
    except RuntimeError as exc:
        # All configured STT providers failed -- surface a clean 503
        # instead of letting it bubble up as an opaque 500.
        logger.error("STT transcription failed for all providers: %s", exc)
        raise HTTPException(
            status_code=503,
            detail="Speech-to-text is temporarily unavailable. Please try typing your question instead.",
        ) from exc
    finally:
        Path(temp_path).unlink(missing_ok=True)


@router.get("/session-status", response_model=SessionStatusResponse)
def session_status(
    session_id: str,
    db: Session = Depends(get_db),
    authorization: str | None = Header(default=None),
    manager: SessionManager = Depends(lambda: session_manager),
):
    current_user = authenticate_assistant_user(db=db, authorization=authorization)
    try:
        session = manager.get_session(session_id, user_id=current_user.id)
        return SessionStatusResponse(exists=True, session=session)
    except SessionNotFoundError:
        return SessionStatusResponse(exists=False, session=None)
    except SessionPermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc


@router.post("/end-session", response_model=EndSessionResponse)
def end_session(
    body: EndSessionRequest,
    db: Session = Depends(get_db),
    authorization: str | None = Header(default=None),
    manager: SessionManager = Depends(lambda: session_manager),
):
    current_user = authenticate_assistant_user(db=db, authorization=authorization)
    try:
        manager.end_session(body.session_id, user_id=current_user.id)
    except SessionNotFoundError:
        pass
    except SessionPermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    return EndSessionResponse(success=True)


def _active_segment(dialogue, index: int):
    if 0 <= index < len(dialogue):
        return dialogue[index]
    return None