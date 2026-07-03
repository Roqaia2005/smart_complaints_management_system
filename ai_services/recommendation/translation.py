"""
translation.py
==============
Detects Arabic text and translates it to English using Groq.
Called once at the start of the pipeline before any analysis.

Why Groq and not a dedicated local MT model?
- Broad web-scale training data handles Egyptian colloquial Arabic/slang
  noticeably better than narrow parallel-corpus MT models (e.g.
  Helsinki-NLP/opus-mt-ar-en), which skew toward formal/MSA text
- Already in the stack, no extra ML dependency (transformers/torch) to
  install or maintain
- Batch processing keeps API calls minimal

CHANGES IN THIS VERSION
------------------------
1. MODEL: uses TRANSLATION_MODEL = llama-3.1-8b-instant specifically (not
   the same model as recommendation-writing). Per Groq's published free-tier
   limits (console.groq.com/docs/rate-limits), this model gets 14,400
   requests/day vs. 1,000/day for llama-3.3-70b-versatile and most other
   models -- by far the most free-tier headroom of any general-purpose
   model on the platform, which matters for a task that runs on every
   fetch of untranslated complaints. It's also Groq's smallest/fastest
   general model, so it doubles as the "lighter model" option.

2. TRANSLATION CACHE (still the main defense against hitting the rate
   limit, independent of which model is configured): fetch_complaints()
   re-fetches the same ~180-day window of complaints on every dashboard
   load / recommendation generation once the short analytics cache TTL
   expires, which would otherwise mean the SAME Arabic complaint text
   gets re-sent to Groq over and over, all day. A persisted, long-TTL,
   content-hash-keyed cache (_TRANSLATION_CACHE) means each distinct
   complaint text is only ever translated once; every later fetch of
   that same complaint is a cache hit and costs zero Groq calls.

No free-tier model is truly limit-free -- 14,400/day is generous
headroom, not an unlimited budget. The cache is what actually keeps
day-to-day usage far below that ceiling; the model choice just raises
the ceiling itself.
"""

import hashlib
import json
import logging
import os

from dotenv import load_dotenv
from groq import Groq

from cache import TTLCache
from config import TRANSLATION_CACHE_TTL_SECONDS, TRANSLATION_MODEL

load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")

logger = logging.getLogger(__name__)

# Keyed by sha256(original_text) -> translated_text. Long TTL (default 30
# days, see config.py) since a given complaint's translation never changes;
# the TTL just bounds memory growth rather than expiring "stale" data.
_TRANSLATION_CACHE = TTLCache(ttl_seconds=TRANSLATION_CACHE_TTL_SECONDS)


def is_arabic(text: str) -> bool:
    """
    Returns True if the text contains Arabic characters.
    Uses Unicode range U+0600 to U+06FF which covers the Arabic block.
    """
    return any('\u0600' <= char <= '\u06FF' for char in str(text))


def _cache_key(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def translate_batch(texts: list[str]) -> list[str]:
    """
    Sends a batch of Arabic texts to Groq and returns English translations.
    Texts are sent numbered so Groq returns them in the same order.
    """
    numbered = "\n".join(f"{i+1}. {t}" for i, t in enumerate(texts))

    prompt = f"""Translate the following Arabic texts to English. These are
university student complaints and may include Egyptian colloquial Arabic
and slang -- translate the intended meaning, not a literal word-for-word
reading.
Return ONLY a JSON array of translated strings in the same order as the input.
No explanation, no numbering in the output, just the JSON array.

Texts to translate:
{numbered}
"""
    client = Groq(api_key=GROQ_API_KEY)
    response = client.chat.completions.create(
        model=TRANSLATION_MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.1,
        max_tokens=2000,
    )

    raw = response.choices[0].message.content.strip()

    # Strip markdown fences if Groq wraps the response
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]

    return json.loads(raw.strip())


def translate_to_english(texts: list[str], batch_size: int = 30) -> list[str]:
    """
    Main translation function. Takes a list of texts (Arabic or English mixed),
    translates only the Arabic ones, and returns the full list with English only.

    Cache-aware: a text whose translation is already cached (e.g. the same
    complaint seen in a previous fetch) is filled in directly from the cache
    and never sent to Groq again. Only genuinely new/uncached Arabic texts
    count against the Groq rate limit.

    Args:
        texts:      List of complaint texts (may be Arabic, English, or mixed)
        batch_size: How many Arabic texts to send per Groq call (default 30)
                    Keep this low to avoid hitting token limits

    Returns:
        Same list with Arabic texts replaced by their English translations.
        English texts are returned unchanged.

    Example:
        Input:  ["Network is slow", "الواي فاي لا يعمل في المكتبة"]
        Output: ["Network is slow", "The wifi does not work in the library"]
    """
    result = list(texts)  # copy so we don't modify the original

    indices_needing_translation = [
        i for i, t in enumerate(texts)
        if t and is_arabic(str(t))
    ]

    if not indices_needing_translation:
        logger.info("No Arabic texts found, skipping translation.")
        return result

    # Split into cache hits (filled in immediately, zero Groq cost) and
    # genuine misses (need a Groq call).
    indices_to_translate = []
    cache_hits = 0
    for i in indices_needing_translation:
        cached_value = _TRANSLATION_CACHE.get(_cache_key(str(texts[i])))
        if cached_value is not None:
            result[i] = cached_value
            cache_hits += 1
        else:
            indices_to_translate.append(i)

    if cache_hits:
        logger.info(
            "Translation cache hit for %d/%d Arabic texts.",
            cache_hits, len(indices_needing_translation),
        )

    if not indices_to_translate:
        logger.info("All Arabic texts served from cache, no Groq call needed.")
        return result

    logger.info("Translating %d Arabic texts to English (cache miss)...", len(indices_to_translate))

    # Process in batches to avoid token limit
    for batch_start in range(0, len(indices_to_translate), batch_size):
        batch_indices = indices_to_translate[batch_start : batch_start + batch_size]
        batch_texts   = [texts[i] for i in batch_indices]

        try:
            translations = translate_batch(batch_texts)

            # Make sure Groq returned the same number of translations
            if len(translations) != len(batch_indices):
                logger.warning(
                    "Translation count mismatch: sent %d, got %d. Keeping originals for this batch.",
                    len(batch_indices), len(translations)
                )
                continue

            # Put translations back in the right positions and cache them
            # so this exact complaint text never triggers another Groq call.
            for i, idx in enumerate(batch_indices):
                translated = translations[i]
                result[idx] = translated
                _TRANSLATION_CACHE.set(_cache_key(str(texts[idx])), translated)

        except Exception as exc:
            logger.error("Translation batch failed: %s. Keeping original texts.", exc)
            # Don't crash the pipeline — keep original Arabic text
            # Groq will still understand it during recommendation generation

    logger.info("Translation complete.")
    return result