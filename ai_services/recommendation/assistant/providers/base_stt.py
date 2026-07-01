"""Abstract speech-to-text provider contract."""

from __future__ import annotations

from abc import ABC, abstractmethod


class BaseSTTProvider(ABC):
    """Interface implemented by all backend STT providers."""

    @property
    @abstractmethod
    def provider_id(self) -> str:
        """Unique identifier matching config keys, for example ``groq_whisper``."""

    @abstractmethod
    async def transcribe(self, audio_file_path: str) -> str:
        """Transcribe an audio file to text."""
