"""Read the local explorer snapshot without raster processing."""

import json
import logging
from pathlib import Path

from pydantic import ValidationError

from cocha_api.schemas.explorer import Snapshot

logger = logging.getLogger(__name__)


def load_snapshot(path: Path) -> Snapshot | None:
    """Return a snapshot, or None when the file is missing or invalid."""

    try:
        raw = path.read_bytes()
    except FileNotFoundError:
        return None
    except OSError:
        logger.error("Pilot snapshot could not be read")
        return None
    try:
        return Snapshot.model_validate_json(raw)
    except (ValidationError, json.JSONDecodeError, UnicodeError, ValueError):
        logger.error("Pilot snapshot is invalid")
        return None
