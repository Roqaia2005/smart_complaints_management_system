"""Abstract text-to-speech provider contract."""

from __future__ import annotations

from abc import ABC, abstractmethod


class BaseTTSProvider(ABC):
    """Interface implemented by all TTS providers."""

    @property
    @abstractmethod
    def provider_id(self) -> str:
        """Unique identifier matching config keys, for example ``edge``."""

    @abstractmethod
    async def synthesize(self, text: str, voice_id: str, output_path: str) -> None:
        """Synthesize text to an MP3 file on disk."""
