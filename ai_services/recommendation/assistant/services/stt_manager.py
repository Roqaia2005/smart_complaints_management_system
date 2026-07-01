"""
Target path: assistant/services/stt_manager.py  (REPLACES existing file)

Backend STT provider manager.

CHANGE IN THIS VERSION
------------------------
Same diagnostic fix as tts_manager.py: logger.error(...) -> 
logger.exception(...) so a provider failure logs its full traceback
instead of just the exception's string representation.

Also note (not changed here, just documented): STT_PROVIDER_CHAIN in
config.py lists "local_whisper" as a fallback, but no LocalWhisperProvider
class exists anywhere in the codebase and routes.py only registers
GroqWhisperProvider(). If Groq Whisper ever fails, this manager will log
a "not registered" warning for local_whisper and then raise
RuntimeError("All configured STT providers failed to transcribe") --
which is now caught explicitly in assistant/routes.py and converted to a
clean 503 instead of an unhandled 500. If you want a real second STT
fallback, that local_whisper provider needs to be implemented.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

from assistant.config import STT_PROVIDER_CHAIN
from assistant.providers.base_stt import BaseSTTProvider

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class TranscriptionResult:
    transcript: str
    confidence: float
    provider_used: str


class STTProviderManager:
    """Transcribes uploaded audio using configured backend fallback providers."""

    def __init__(self, providers: list[BaseSTTProvider]) -> None:
        self.providers = {provider.provider_id: provider for provider in providers}

    async def transcribe_audio(self, audio_file_path: str) -> TranscriptionResult:
        for provider_key in STT_PROVIDER_CHAIN:
            provider = self.providers.get(provider_key)
            if not provider:
                logger.warning("STT provider %s configured but not registered", provider_key)
                continue
            try:
                logger.info("Attempting STT transcription via %s", provider_key)
                transcript = await provider.transcribe(audio_file_path)
                return TranscriptionResult(
                    transcript=transcript,
                    confidence=0.94,
                    provider_used=provider_key,
                )
            except Exception:
                logger.exception("STT provider %s failed", provider_key)
                continue
        raise RuntimeError("All configured STT providers failed to transcribe")