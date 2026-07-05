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

    def get(self, key: str) -> Optional[Any]:
        """Look up a key without computing/storing anything on a miss.

        Returns the cached value if present and not expired, otherwise None.
        Used by translation.py to check "do we already have this translated?"
        without being willing to compute a fresh value on a miss -- the
        caller (translate_to_english) decides what to do on a miss itself
        (batch it up for a single Groq call), rather than get_or_set()'s
        one-value-at-a-time compute-on-miss behavior.
        """
        now = time.monotonic()
        with self._lock:
            cached = self._store.get(key)
            if cached is None:
                return None
            expires_at, value = cached
            return value if expires_at > now else None

    def set(self, key: str, value: Any) -> None:
        """Directly store a precomputed value under key with this cache's TTL."""
        with self._lock:
            self._store[key] = (time.monotonic() + self.ttl_seconds, value)

    def invalidate(self, key: Optional[str] = None) -> None:
        with self._lock:
            if key is None:
                self._store.clear()
            else:
                self._store.pop(key, None)