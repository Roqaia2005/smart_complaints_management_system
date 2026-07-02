"""
Configuration for the Recommendation and Decision Support System.

CHANGES IN THIS VERSION
-----------------------
Added env-tunable constants for the recommendation and DSS features:

- ANALYTICS_CACHE_TTL_SECONDS: how long the DSS analytics snapshot is
  cached before being recomputed (fixes redundant recomputation lag).
  Default 90s -- long enough to absorb a burst of dashboard widget
  calls, short enough that a manager refreshing the page still sees
  reasonably fresh numbers.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Final


# ── Groq LLM ────────────────────────────────────────────────────────────────

GROQ_TIMEOUT_SECONDS: Final[int] = 5
GROQ_MODEL: Final[str] = "llama-3.3-70b-versatile"

# ── Analytics cache ─────────────────────────────────────────────────────────

ANALYTICS_CACHE_TTL_SECONDS: Final[int] = int(os.getenv("ANALYTICS_CACHE_TTL_SECONDS", "90"))

# ── Paths ───────────────────────────────────────────────────────────────────

MODULE_ROOT: Final[Path] = Path(__file__).resolve().parent
RECOMMENDATION_ROOT: Final[Path] = MODULE_ROOT.parent

# ── TTS (Executive Briefing) ────────────────────────────────────────────────

# Provider fallback chain order (first available wins).
# Options: "edge" (Microsoft Edge TTS), "kokoro" (local Kokoro TTS)
TTS_PROVIDER_CHAIN: Final[list[str]] = [
    p.strip()
    for p in os.getenv("TTS_PROVIDER_CHAIN", "edge,kokoro").split(",")
    if p.strip()
]

# Voice role → language → provider mapping.
# Each entry must define at least one provider ("edge" and/or "kokoro").
# Supported languages: "en" (English), "ar" (Arabic).
VOICE_CONFIG: Final[dict] = {
    "briefing": {
        # English voices
        "en": {
            "edge": "en-US-JennyNeural",
            "kokoro": "en-US-female-1",  # adjust to your Kokoro voice IDs

        },
        # Arabic voices (for Arabic briefing text)
        "ar": {
            "edge": "ar-EG-SalmaNeural",
            "kokoro": "ar-EG-female-1",  # adjust to your Kokoro voice IDs
        },
    }
}

# Where synthesized audio files are cached on disk.
AUDIO_CACHE_DIR: Final[Path] = Path(
    os.getenv("AUDIO_CACHE_DIR", str(RECOMMENDATION_ROOT / "static" / "audio"))
)





