"""
Pydantic schemas for the AI Executive Voice Briefing Assistant.

These models are intentionally passive contracts. They do not call DSS,
recommendation, Groq, TTS, STT, or persistence code.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


SpeakerRole = Literal["host", "analyst", "user"]
BriefingSpeakerRole = Literal["host", "analyst"]
SessionStatus = Literal[
    "generating",
    "ready",
    "playing",
    "paused",
    "answering",
    "answer_active",
    "expired",
]


class GenerateBriefingRequest(BaseModel):
    """Request body for POST /api/assistant/generate-briefing."""

    force_refresh: bool = False


class DialogueSegment(BaseModel):
    """A single playable briefing turn."""

    index: int = Field(ge=0)
    speaker: BriefingSpeakerRole
    text: str = Field(min_length=1)
    audio_url: Optional[str] = None
    topic: str
    risk_score: Optional[float] = None
    recommendation: Optional[str] = None


class ConversationHistoryItem(BaseModel):
    """A spoken or typed turn stored inside an assistant session."""

    speaker: SpeakerRole
    text: str = Field(min_length=1)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class ConversationState(BaseModel):
    """Server-side equivalent of the documented frontend conversation state."""

    session_id: str
    user_id: int
    current_dialogue_index: int = Field(default=0, ge=0)
    is_playing: bool = False
    is_recording: bool = False
    active_speaker: Optional[BriefingSpeakerRole] = None
    active_topic: Optional[str] = None
    active_risk_score: Optional[float] = None
    active_recommendation: Optional[str] = None
    conversation_history: list[ConversationHistoryItem] = Field(default_factory=list)


class AssistantSessionSnapshot(BaseModel):
    """Serializable in-memory session payload for v1 SessionManager."""

    session_id: str
    user_id: int
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    expires_at: datetime
    analytics_snapshot: dict[str, Any]
    dialogue_script: list[DialogueSegment] = Field(default_factory=list)
    current_dialogue_index: int = Field(default=0, ge=0)
    conversation_history: list[ConversationHistoryItem] = Field(default_factory=list)
    status: SessionStatus = "generating"


class GenerateBriefingResponse(BaseModel):
    """Response body for POST /api/assistant/generate-briefing."""

    session_id: str
    summary: str
    dialogue: list[DialogueSegment]
    suggested_questions: list[str]


class AskQuestionRequest(BaseModel):
    """Request body for POST /api/assistant/ask."""

    session_id: str
    question: str = Field(min_length=1)
    current_dialogue_index: int = Field(ge=0)


class AskQuestionResponse(BaseModel):
    """Response body for POST /api/assistant/ask."""

    answer: str
    audio_url: Optional[str] = None
    resume_index: int = Field(ge=0)
    suggested_questions: list[str]


class STTResponse(BaseModel):
    """Response body for POST /api/assistant/stt."""

    transcript: str
    confidence: float = Field(ge=0.0, le=1.0)
    provider_used: str


class SessionStatusResponse(BaseModel):
    """Response body for GET /api/assistant/session-status."""

    exists: bool
    session: Optional[AssistantSessionSnapshot] = None


class EndSessionRequest(BaseModel):
    """Request body for POST /api/assistant/end-session."""

    session_id: str


class EndSessionResponse(BaseModel):
    """Response body for POST /api/assistant/end-session."""

    success: bool
