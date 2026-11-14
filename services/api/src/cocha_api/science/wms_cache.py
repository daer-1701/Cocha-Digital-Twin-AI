"""Small in-memory LRU cache for identical GetMap responses."""

from collections import OrderedDict
from threading import Lock


class LruBytesCache:
    def __init__(self, maxsize: int = 32) -> None:
        if maxsize < 1:
            raise ValueError("maxsize must be at least 1")
        self._maxsize = maxsize
        self._data: OrderedDict[str, tuple[bytes, str]] = OrderedDict()
        self._lock = Lock()

    def get(self, key: str) -> tuple[bytes, str] | None:
        with self._lock:
            value = self._data.get(key)
            if value is None:
                return None
            self._data.move_to_end(key)
            return value

    def set(self, key: str, content: bytes, content_type: str) -> None:
        with self._lock:
            self._data[key] = (content, content_type)
            self._data.move_to_end(key)
            while len(self._data) > self._maxsize:
                self._data.popitem(last=False)

    def clear(self) -> None:
        with self._lock:
            self._data.clear()
