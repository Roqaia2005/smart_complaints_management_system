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

- TRANSLATION_MODEL is a Groq model: llama-3.1-8b-instant specifically,
  because per Groq's published free-tier limits
  (console.groq.com/docs/rate-limits) it gets 14,400 requests/day vs.
  1,000/day for llama-3.3-70b-versatile and most other models -- by far
  the most headroom of any general-purpose model, which matters for a
  task (translation) that used to run on every fetch of untranslated
  complaints. RECOMMENDATION_MODEL is a separate, stronger Groq model
  used only for writing the recommendation paragraph -- see below.

- TRANSLATION_CACHE_TTL_SECONDS: translated complaint text is cached
  (see translation.py) so the same complaint is never re-translated on
  every dashboard refresh -- this is what actually keeps day-to-day Groq
  usage far below the daily cap; the model choice just raises the cap.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Final


# ── Groq LLM ────────────────────────────────────────────────────────────────

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

# ── Translation (also Groq, but a different model -- see rationale above) ──

# llama-3.1-8b-instant: Groq's smallest/fastest general model, and the one
# with by far the highest free-tier daily request cap (14,400 vs 1,000 for
# most other models per console.groq.com/docs/rate-limits). Broad web-scale
# training also handles Egyptian colloquial Arabic/slang noticeably better
# than a narrow parallel-corpus MT model would.
TRANSLATION_MODEL: Final[str] = os.getenv("TRANSLATION_MODEL", "llama-3.1-8b-instant")

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