"""
Session lifecycle management for the AI Executive Voice Briefing Assistant.

Version 1 uses the approved in-memory session store. The public manager API is
kept storage-agnostic so Redis can replace the backing store later.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from datetime import datetime, timedelta
from threading import RLock
from typing import Optional
from uuid import uuid4

from assistant.schemas import (
    AssistantSessionSnapshot,
    ConversationHistoryItem,
    DialogueSegment,
    SessionStatus,
)
from assistant.config import ASSISTANT_SESSION_TTL_MINUTES


SESSION_TTL_MINUTES = ASSISTANT_SESSION_TTL_MINUTES


class SessionNotFoundError(Exception):
    """Raised when a requested assistant session does not exist or expired."""


class SessionPermissionError(Exception):
    """Raised when a user attempts to access another user's session."""


class SessionStore(ABC):
    """Storage abstraction for assistant sessions."""

    @abstractmethod
    def get(self, session_id: str) -> Optional[AssistantSessionSnapshot]:
        """Return a session snapshot or None."""

    @abstractmethod
    def save(self, session: AssistantSessionSnapshot) -> None:
        """Persist a session snapshot."""

    @abstractmethod
    def delete(self, session_id: str) -> None:
        """Delete a session snapshot if present."""

    @abstractmethod
    def cleanup_expired(self, now: Optional[datetime] = None) -> int:
        """Delete expired sessions and return the number removed."""


class InMemorySessionStore(SessionStore):
    """Thread-safe in-memory session store for the v1 implementation."""

    def __init__(self) -> None:
        self._sessions: dict[str, AssistantSessionSnapshot] = {}
        self._lock = RLock()

    def get(self, session_id: str) -> Optional[AssistantSessionSnapshot]:
        with self._lock:
            return self._sessions.get(session_id)

    def save(self, session: AssistantSessionSnapshot) -> None:
        with self._lock:
            self._sessions[session.session_id] = session

    def delete(self, session_id: str) -> None:
        with self._lock:
            self._sessions.pop(session_id, None)

    def cleanup_expired(self, now: Optional[datetime] = None) -> int:
        current_time = now or datetime.utcnow()
        with self._lock:
            expired_ids = [
                session_id
                for session_id, session in self._sessions.items()
                if session.expires_at <= current_time
            ]
            for session_id in expired_ids:
                self._sessions.pop(session_id, None)
            return len(expired_ids)


class SessionManager:
    """Coordinates assistant session creation, updates, and ownership checks."""

    def __init__(
        self,
        store: Optional[SessionStore] = None,
        ttl_minutes: int = SESSION_TTL_MINUTES,
    ) -> None:
        self.store = store or InMemorySessionStore()
        self.ttl = timedelta(minutes=ttl_minutes)

    def create_session(
        self,
        user_id: int,
        analytics_snapshot: dict,
        dialogue_script: Optional[list[DialogueSegment]] = None,
        status: SessionStatus = "generating",
    ) -> AssistantSessionSnapshot:
        now = datetime.utcnow()
        session = AssistantSessionSnapshot(
            session_id=f"sess_{uuid4().hex}",
            user_id=user_id,
            created_at=now,
            updated_at=now,
            expires_at=now + self.ttl,
            analytics_snapshot=analytics_snapshot,
            dialogue_script=dialogue_script or [],
            current_dialogue_index=0,
            conversation_history=[],
            status=status,
        )
        self.store.save(session)
        return session

    def get_session(
        self,
        session_id: str,
        user_id: Optional[int] = None,
        touch: bool = True,
    ) -> AssistantSessionSnapshot:
        self.store.cleanup_expired()
        session = self.store.get(session_id)
        if session is None:
            raise SessionNotFoundError(f"Assistant session not found: {session_id}")
        if session.expires_at <= datetime.utcnow():
            self.store.delete(session_id)
            raise SessionNotFoundError(f"Assistant session expired: {session_id}")
        if user_id is not None and session.user_id != user_id:
            raise SessionPermissionError("Assistant session belongs to a different user")
        if touch:
            self._touch(session)
        return session

    def save_dialogue(
        self,
        session_id: str,
        dialogue_script: list[DialogueSegment],
        user_id: Optional[int] = None,
        status: SessionStatus = "ready",
    ) -> AssistantSessionSnapshot:
        session = self.get_session(session_id, user_id=user_id)
        session.dialogue_script = dialogue_script
        session.status = status
        self._touch(session)
        return session

    def update_playback(
        self,
        session_id: str,
        current_dialogue_index: int,
        user_id: Optional[int] = None,
        status: Optional[SessionStatus] = None,
    ) -> AssistantSessionSnapshot:
        session = self.get_session(session_id, user_id=user_id)
        session.current_dialogue_index = max(current_dialogue_index, 0)
        if status:
            session.status = status
        self._touch(session)
        return session

    def append_history(
        self,
        session_id: str,
        items: list[ConversationHistoryItem],
        user_id: Optional[int] = None,
    ) -> AssistantSessionSnapshot:
        session = self.get_session(session_id, user_id=user_id)
        session.conversation_history.extend(items)
        self._touch(session)
        return session

    def end_session(self, session_id: str, user_id: Optional[int] = None) -> None:
        if user_id is not None:
            self.get_session(session_id, user_id=user_id, touch=False)
        self.store.delete(session_id)

    def _touch(self, session: AssistantSessionSnapshot) -> None:
        now = datetime.utcnow()
        session.updated_at = now
        session.expires_at = now + self.ttl
        self.store.save(session)


session_manager = SessionManager()
