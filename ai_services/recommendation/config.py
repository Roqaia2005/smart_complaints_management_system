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

- TRANSLATION_MODEL now names a LOCAL HuggingFace translation model
  (Helsinki-NLP/opus-mt-ar-en), not a Groq model. Translation no longer
  calls Groq at all -- see translation.py. RECOMMENDATION_MODEL is still
  a Groq model, used only for writing the recommendation paragraph.

- TRANSLATION_CACHE_TTL_SECONDS: translated complaint text is cached
  (see translation.py) so the same complaint is never re-translated on
  every dashboard refresh.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Final


# ── Groq LLM (recommendation writing only) ──────────────────────────────────

GROQ_TIMEOUT_SECONDS: Final[int] = 5

# Model used to write the recommendation paragraph. This needs good
# instruction-following (strict JSON, explaining analytical findings
# without contradicting them) but runs rarely -- once per category per
# RECOMMENDATION_CACHE_HOURS -- so a stronger/slower model is affordable.
# If this call fails (rate limit, timeout, malformed JSON), recommendation.py
# falls back to a deterministic template (see recommendation_templates.py)
# rather than skipping the category entirely.
RECOMMENDATION_MODEL: Final[str] = os.getenv("RECOMMENDATION_MODEL", "llama-3.3-70b-versatile")

# Kept as an alias for backward compatibility with anything still importing
# GROQ_MODEL directly; new code should use RECOMMENDATION_MODEL instead.
GROQ_MODEL: Final[str] = RECOMMENDATION_MODEL

# ── Translation (local, no Groq / no API) ───────────────────────────────────

# HuggingFace model id for local Arabic -> English translation. Downloaded
# once and cached under ~/.cache/huggingface. See translation.py.
TRANSLATION_MODEL: Final[str] = os.getenv("TRANSLATION_MODEL", "Helsinki-NLP/opus-mt-ar-en")

# ── Analytics cache ─────────────────────────────────────────────────────────

ANALYTICS_CACHE_TTL_SECONDS: Final[int] = int(os.getenv("ANALYTICS_CACHE_TTL_SECONDS", "90"))

# How long a translated string is cached before being eligible for
# re-translation. Translations of a given complaint text don't change, so
# this is set long (default 30 days) purely to bound memory / allow an
# eventual refresh, not because the translation goes stale.
TRANSLATION_CACHE_TTL_SECONDS: Final[int] = int(
    os.getenv("TRANSLATION_CACHE_TTL_SECONDS", str(30 * 24 * 3600))
)

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