"""In-memory sliding window limiter for a single process."""

import threading
import time


class MemoryRateLimiter:
    def __init__(self) -> None:
        self._hits: dict[str, list[float]] = {}
        self._lock = threading.Lock()

    def allow(
        self,
        key: str,
        *,
        limit: int,
        window_seconds: float,
        now: float | None = None,
    ) -> bool:
        if limit < 1 or window_seconds <= 0:
            raise ValueError("limit and window must be positive")
        moment = time.monotonic() if now is None else now
        with self._lock:
            recent = [hit for hit in self._hits.get(key, []) if moment - hit < window_seconds]
            if len(recent) >= limit:
                self._hits[key] = recent
                return False
            recent.append(moment)
            self._hits[key] = recent
            return True

    def clear(self) -> None:
        with self._lock:
            self._hits.clear()


wms_rate_limiter = MemoryRateLimiter()
