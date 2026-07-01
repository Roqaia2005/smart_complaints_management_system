"""
Target path: assistant/config.py  (REPLACES existing file)

Configuration for the AI Executive Voice Briefing Assistant.

CHANGES IN THIS VERSION
------------------------
Added two new env-tunable constants used by the fixes in this round:

- ANALYTICS_CACHE_TTL_SECONDS: how long the DSS/assistant analytics
  snapshot is cached before being recomputed (fixes the redundant
  recomputation lag). Default 90s -- long enough to absorb a burst of
  dashboard widget calls, short enough that a manager refreshing the
  page still sees reasonably fresh numbers.

- ASSISTANT_DIALOGUE_WORKERS: max number of agenda steps the
  ConversationDirector will generate concurrently via a thread pool
  (fixes the 9-sequential-blocking-Groq-calls lag). Default 6.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Final


ASSISTANT_SESSION_TTL_MINUTES: Final[int] = 30
GROQ_TIMEOUT_SECONDS: Final[int] = 5
GROQ_MODEL: Final[str] = "meta-llama/llama-4-scout-17b-16e-instruct"

ANALYTICS_CACHE_TTL_SECONDS: Final[int] = int(os.getenv("ANALYTICS_CACHE_TTL_SECONDS", "90"))
ASSISTANT_DIALOGUE_WORKERS: Final[int] = int(os.getenv("ASSISTANT_DIALOGUE_WORKERS", "6"))

MODULE_ROOT: Final[Path] = Path(__file__).resolve().parent
RECOMMENDATION_ROOT: Final[Path] = MODULE_ROOT.parent
STATIC_ROOT: Final[Path] = RECOMMENDATION_ROOT / "static"
AUDIO_CACHE_DIR: Final[Path] = STATIC_ROOT / "audio"

TTS_PROVIDER_CHAIN: Final[list[str]] = ["edge", "kokoro", "elevenlabs"]
STT_PROVIDER_CHAIN: Final[list[str]] = ["groq_whisper", "local_whisper"]

VOICE_CONFIG: Final[dict[str, dict[str, str]]] = {
    "host": {
        "gender": "male",
        "edge": "en-US-GuyNeural",
        "kokoro": "en_us_male_guy",
        "elevenlabs": "eleven_monica_male",
    },
    "analyst": {
        "gender": "female",
        "edge": "en-US-AriaNeural",
        "kokoro": "en_us_female_aria",
        "elevenlabs": "eleven_rachel_female",
    },
}