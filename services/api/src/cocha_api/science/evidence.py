"""Read the local explorer snapshot without raster processing."""

import json
import logging
from functools import lru_cache
from pathlib import Path

from pydantic import ValidationError

from cocha_api.schemas.explorer import Snapshot

logger = logging.getLogger(__name__)


def _revision(path: Path) -> tuple[int, int, int, int]:
    info = path.stat()
    return info.st_mtime_ns, info.st_ctime_ns, info.st_size, info.st_ino


@lru_cache(maxsize=4)
def _validated_snapshot(path: Path, revision: tuple[int, int, int, int]) -> Snapshot:
    raw = path.read_bytes()
    if _revision(path) != revision:
        raise OSError("Snapshot changed during publication")
    return Snapshot.model_validate_json(raw)


def read_snapshot(path: Path) -> Snapshot:
    """Reuse validation across endpoints; invalidate on file replacement or modification.

    Return an independent model so a consumer cannot mutate another response.
    Missing/invalid snapshots still raise; no stale fallback hides publication errors.
    Publishers should replace snapshots atomically.
    """
    resolved = path.resolve()
    return _validated_snapshot(resolved, _revision(resolved)).model_copy(deep=True)


def load_snapshot(path: Path) -> Snapshot | None:
    """Return a snapshot, or None when the file is missing or invalid."""

    try:
        return read_snapshot(path)
    except FileNotFoundError:
        return None
    except OSError:
        logger.error("Pilot snapshot could not be read")
        return None
    except (ValidationError, json.JSONDecodeError, UnicodeError, ValueError):
        logger.error("Pilot snapshot is invalid")
        return None
