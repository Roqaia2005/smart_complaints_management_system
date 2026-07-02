"""Kokoro TTS fallback provider placeholder."""

from __future__ import annotations

from base_tts import BaseTTSProvider


class KokoroTTSProvider(BaseTTSProvider):
    """Fallback provider slot for a future local Kokoro runtime."""

    @property
    def provider_id(self) -> str:
        return "kokoro"

    async def synthesize(self, text: str, voice_id: str, output_path: str) -> None:
        raise RuntimeError("Kokoro TTS provider is not configured in this deployment")
