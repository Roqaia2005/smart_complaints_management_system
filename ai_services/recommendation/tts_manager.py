
from __future__ import annotations

import hashlib
import logging
import re
from pathlib import Path
from typing import Optional

from config import AUDIO_CACHE_DIR, TTS_PROVIDER_CHAIN, VOICE_CONFIG
from base_tts import BaseTTSProvider

logger = logging.getLogger(__name__)

# Unicode block for Arabic script (covers Arabic, Arabic Supplement, and
# Arabic Presentation Forms) -- enough to reliably detect Arabic text without
# pulling in a full language-detection dependency.
_ARABIC_RE = re.compile(r"[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]")

# Hard-coded safety net so Arabic text is never silently spoken by an
# English-only voice, even if VOICE_CONFIG in assistant/config.py is ever
# missing an Arabic entry for a given role/provider. Prefer keeping
# VOICE_CONFIG itself complete -- this is a last resort, and only covers
# "edge" since that's the only provider with confirmed Arabic voice IDs
# (see assistant/config.py).
_FALLBACK_VOICE_BY_LANGUAGE = {
    "ar": {"edge": "ar-EG-SalmaNeural"},
    "en": {"edge": "en-US-JennyNeural"},
}


def detect_text_language(text: str) -> str:
    """Return 'ar' if the text is majority-Arabic-script, else 'en'.

    This is intentionally simple: it counts Arabic-script characters vs.
    Latin letters rather than trying to do full language ID, because the
    only decision that matters here is "which voice do I need".
    """
    if not text:
        return "en"
    arabic_chars = len(_ARABIC_RE.findall(text))
    latin_chars = len(re.findall(r"[A-Za-z]", text))
    return "ar" if arabic_chars > latin_chars else "en"


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

    async def generate_audio(
        self,
        text: str,
        voice_role: str,
        language: Optional[str] = None,
    ) -> Optional[str]:
        """Synthesize `text` for `voice_role`, picking a voice for its language.

        BUG THIS FIXES: this method used to resolve the voice purely from
        `voice_role` (e.g. "host"/"analyst"), with no notion of language at
        all -- and VOICE_CONFIG in assistant/config.py had no Arabic voice
        IDs defined for any role/provider in the first place. So Arabic
        briefing text was always synthesized with an English neural voice,
        because that was the only voice configured. `language` is now
        resolved per call (auto-detected from `text` if the caller doesn't
        pass it explicitly) and used, along with `voice_role`, to select the
        voice from VOICE_CONFIG[role][language][provider].
        """
        resolved_language = language or detect_text_language(text)

        attempted: list[str] = []
        for provider_key in TTS_PROVIDER_CHAIN:
            provider = self.providers.get(provider_key)
            if not provider:
                logger.warning("TTS provider %s configured but not registered", provider_key)
                continue

            voice_id = self._resolve_voice_id(voice_role, resolved_language, provider_key)
            if not voice_id:
                logger.warning(
                    "No voice configured for role=%s language=%s provider=%s",
                    voice_role, resolved_language, provider_key,
                )
                continue

            output_path = self._output_path(text, voice_id, provider_key)
            if output_path.exists():
                return self._to_audio_url(output_path)

            attempted.append(provider_key)
            try:
                logger.info(
                    "Attempting TTS synthesis via %s (language=%s, voice=%s)",
                    provider_key, resolved_language, voice_id,
                )
                await provider.synthesize(text, voice_id, str(output_path))
                return self._to_audio_url(output_path)
            except Exception:
                # logger.exception captures the full traceback -- this is the
                # single most important diagnostic line for tracking down why
                # audio silently fails to play on the frontend.
                logger.exception("TTS provider %s failed", provider_key)
                continue

        logger.error(
            "All TTS providers failed or were unavailable for voice_role=%s language=%s. Attempted: %s. "
            "Returning audio_url=None; frontend should fall back to text-only display.",
            voice_role,
            resolved_language,
            attempted or "none (no provider/voice configured at all)",
        )
        return None

    def _resolve_voice_id(self, voice_role: str, language: str, provider_key: str) -> Optional[str]:
        role_config = VOICE_CONFIG.get(voice_role, {})

        # VOICE_CONFIG[role][language][provider] -> voice_id
        language_config = role_config.get(language)
        if isinstance(language_config, dict):
            voice_id = language_config.get(provider_key)
            if voice_id:
                return voice_id

        # Last-resort hard-coded fallback so a role/provider missing an
        # explicit Arabic (or English) entry in VOICE_CONFIG still gets a
        # correct-language voice instead of silently getting none/wrong one.
        fallback = _FALLBACK_VOICE_BY_LANGUAGE.get(language, {}).get(provider_key)
        if fallback:
            logger.warning(
                "VOICE_CONFIG has no %s voice for role=%s/provider=%s; using hard-coded fallback %s. "
                "Add an explicit entry to VOICE_CONFIG in assistant/config.py to silence this warning.",
                language, voice_role, provider_key, fallback,
            )
        return fallback

    def _output_path(self, text: str, voice_id: str, provider_id: str) -> Path:
        cache_key = hashlib.sha256(f"{provider_id}|{voice_id}|{text}".encode("utf-8")).hexdigest()
        return self.audio_cache_dir / f"{cache_key}.mp3"

    def _to_audio_url(self, output_path: Path) -> str:
        return f"/static/audio/{output_path.name}"