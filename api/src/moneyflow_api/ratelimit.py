"""In-memory sliding-window rate limiter keyed by uid.

State is per process. Cloud Run runs at most two instances, so the effective
ceiling is at most twice the configured limit, which is fine for abuse control.
"""

import math
import threading
import time
from collections import deque
from collections.abc import Callable

DEFAULT_LIMIT = 30
DEFAULT_WINDOW_SECONDS = 60.0
_SWEEP_EVERY = 1000


class SlidingWindowRateLimiter:
    def __init__(
        self,
        limit: int = DEFAULT_LIMIT,
        window_seconds: float = DEFAULT_WINDOW_SECONDS,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self._limit = limit
        self._window = window_seconds
        self._clock = clock
        self._hits: dict[str, deque[float]] = {}
        self._lock = threading.Lock()
        self._calls = 0

    def hit(self, key: str) -> int | None:
        """Record a request. Returns None when allowed, else seconds until a slot frees up."""
        now = self._clock()
        with self._lock:
            self._maybe_sweep(now)
            window = self._hits.setdefault(key, deque())
            self._expire(window, now)
            if len(window) >= self._limit:
                return max(1, math.ceil(window[0] + self._window - now))
            window.append(now)
            return None

    def forget(self, key: str) -> None:
        with self._lock:
            self._hits.pop(key, None)

    def _expire(self, window: deque[float], now: float) -> None:
        while window and window[0] <= now - self._window:
            window.popleft()

    def _maybe_sweep(self, now: float) -> None:
        self._calls += 1
        if self._calls % _SWEEP_EVERY:
            return
        for key in list(self._hits):
            window = self._hits[key]
            self._expire(window, now)
            if not window:
                del self._hits[key]
