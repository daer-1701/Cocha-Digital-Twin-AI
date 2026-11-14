import logging

from fastapi import APIRouter, HTTPException
from pydantic import ValidationError

from cocha_api.core.config import get_settings
from cocha_api.schemas.explorer import ExplorerResponse, Snapshot

router = APIRouter(prefix="/v1/explorer", tags=["evidence"])


@router.get("", response_model=ExplorerResponse)
def explorer() -> ExplorerResponse:
    path = get_settings().evidence_path
    try:
        snapshot = Snapshot.model_validate_json(path.read_bytes())
    except FileNotFoundError:
        return ExplorerResponse(status="empty")
    except (OSError, ValidationError):
        logging.getLogger(__name__).error("Evidence snapshot unavailable or invalid")
        raise HTTPException(status_code=503, detail="Evidence unavailable") from None
    return ExplorerResponse(status="available", evidence=snapshot)
