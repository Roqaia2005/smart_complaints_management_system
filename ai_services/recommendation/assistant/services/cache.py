"""
Target path: assistant/services/cache.py  (NEW FILE)

Lightweight thread-safe TTL cache.

WHY THIS EXISTS
----------------
Before this fix, every DSS/assistant endpoint independently called
fetch_complaints() -> translate_to_english() -> compute_statistics() ->
build_category_insights() from scratch, with zero sharing of results.

A single dashboard page load that hits /api/dss/dashboard,
/api/dss/risk-ranking, /api/dss/executive-summary, and /api/dss/alerts
was re-running the ENTIRE analytical pipeline (including Arabic->English
translation via Groq) up to 4-5 times. This was the primary source of
the reported "lag".

This cache is intentionally simple (in-memory, single key per cached
object) per the architecture doc's Caching Topology (section 12), which
calls for a short-lived "Analytics Cache" distinct from the 24h
AiRecommendation cache used by the recommendation pipeline. It is NOT a
replacement for that 24h cache -- it solves a different problem
(duplicate work within the same few seconds, not LLM cost amortization).

Known limitation: a cache-miss stampede (many concurrent requests all
missing at once) will compute the value multiple times. Given the
request volume here (a handful of managers, not public traffic) this is
an acceptable trade-off for the complexity it avoids. If this ever
becomes a problem, add a per-key lock around the builder() call.
"""

from __future__ import annotations

import threading
import time
from typing import Any, Callable, Optional


class TTLCache:
    """Minimal get-or-compute cache with a fixed TTL per instance."""

    def __init__(self, ttl_seconds: float) -> None:
        self.ttl_seconds = ttl_seconds
        self._lock = threading.RLock()
        self._store: dict[str, tuple[float, Any]] = {}

    def get_or_set(self, key: str, builder: Callable[[], Any]) -> Any:
        now = time.monotonic()
        with self._lock:
            cached = self._store.get(key)
            if cached is not None:
                expires_at, value = cached
                if expires_at > now:
                    return value

        # Compute outside the lock so a slow build doesn't block other keys.
        value = builder()

        with self._lock:
            self._store[key] = (now + self.ttl_seconds, value)
        return value

    def invalidate(self, key: Optional[str] = None) -> None:
        with self._lock:
            if key is None:
                self._store.clear()
            else:
                self._store.pop(key, None)