

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