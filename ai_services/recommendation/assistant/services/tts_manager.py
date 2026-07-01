"""
Target path: assistant/services/tts_manager.py  (REPLACES existing file)

Cache-first TTS provider manager.

CHANGE IN THIS VERSION
------------------------
This is the component behind the "no audio plays, no error shown"
symptom. Its fallback-chain design is intentional per the architecture
doc (NFR 15.3: if all TTS providers fail, return audio_url: null and let
the frontend fall back to text-only) -- so it correctly should NOT raise
an exception up to the client. The problem was that the only trace of
*why* it failed was `logger.error("TTS provider %s failed: %s", key,
exc)`, which logs just the exception's string repr -- often just
"" for some network errors -- with no traceback. That makes the real
cause (missing edge-tts package, blocked outbound network call to
Microsoft's TTS endpoint, Kokoro's stub always raising, etc.) invisible
in the logs.

Changed `logger.error(...)` to `logger.exception(...)`, which logs the
full traceback. Next time this happens, the logs will show exactly which
provider failed and why instead of a single opaque line.

No behavioral change otherwise -- the fallback chain and silent
audio_url=None-on-total-failure contract are preserved as designed.
"""

from __future__ import annotations

import hashlib
import logging
from pathlib import Path
from typing import Optional

from assistant.config import AUDIO_CACHE_DIR, TTS_PROVIDER_CHAIN, VOICE_CONFIG
from assistant.providers.base_tts import BaseTTSProvider

logger = logging.getLogger(__name__)


class TTSProviderManager:
    """Resolves audio files using configured TTS provider fallbacks."""

    def __init__(
        self,
        providers: list[BaseTTSProvider],
        audio_cache_dir: Path = AUDIO_CACHE_DIR,
    ) -> None:
        self.providers = {provider.provider_id: provider for provider in providers}
        self.audio_cache_dir = audio_cache_dir
        self.audio_cache_dir.mkdir(parents=True, exist_ok=True)

    async def generate_audio(self, text: str, voice_role: str) -> Optional[str]:
        attempted: list[str] = []
        for provider_key in TTS_PROVIDER_CHAIN:
            provider = self.providers.get(provider_key)
            if not provider:
                logger.warning("TTS provider %s configured but not registered", provider_key)
                continue

            voice_id = VOICE_CONFIG.get(voice_role, {}).get(provider_key)
            if not voice_id:
                logger.warning("No voice configured for role=%s provider=%s", voice_role, provider_key)
                continue

            output_path = self._output_path(text, voice_id, provider_key)
            if output_path.exists():
                return self._to_audio_url(output_path)

            attempted.append(provider_key)
            try:
                logger.info("Attempting TTS synthesis via %s", provider_key)
                await provider.synthesize(text, voice_id, str(output_path))
                return self._to_audio_url(output_path)
            except Exception:
                # logger.exception captures the full traceback -- this is the
                # single most important diagnostic line for tracking down why
                # audio silently fails to play on the frontend.
                logger.exception("TTS provider %s failed", provider_key)
                continue

        logger.error(
            "All TTS providers failed or were unavailable for voice_role=%s. Attempted: %s. "
            "Returning audio_url=None; frontend should fall back to text-only display.",
            voice_role,
            attempted or "none (no provider/voice configured at all)",
        )
        return None

    def _output_path(self, text: str, voice_id: str, provider_id: str) -> Path:
        cache_key = hashlib.sha256(f"{provider_id}|{voice_id}|{text}".encode("utf-8")).hexdigest()
        return self.audio_cache_dir / f"{cache_key}.mp3"

    def _to_audio_url(self, output_path: Path) -> str:
        return f"/static/audio/{output_path.name}"