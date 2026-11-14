"""Assistant budget status. This route never calls Gemini."""

import json
import logging

from fastapi import APIRouter

from cocha_api.core.config import get_settings
from cocha_api.schemas.assistant import ASSISTANT_REASON, PRICES_NOTE, AssistantStatusResponse
from cocha_api.science.assistant import read_ledger_totals

router = APIRouter(prefix="/v1", tags=["assistant"])
logger = logging.getLogger(__name__)


def _key_configured() -> bool:
    secret = get_settings().gemini_api_key
    return secret is not None and bool(secret.get_secret_value().strip())


@router.get("/assistant", response_model=AssistantStatusResponse)
def assistant_status() -> AssistantStatusResponse:
    settings = get_settings()
    try:
        spent, reserved = read_ledger_totals(
            settings.gemini_ledger_path, settings.gemini_budget_usd
        )
    except (OSError, ValueError, KeyError, TypeError, json.JSONDecodeError):
        logger.error("Gemini budget ledger could not be read")
        spent, reserved = 0.0, 0.0
        reason = "Gemini calls are disabled. The budget ledger could not be read."
    else:
        reason = ASSISTANT_REASON
    return AssistantStatusResponse(
        status="unavailable",
        reason=reason,
        model=settings.gemini_model,
        budget_usd=settings.gemini_budget_usd,
        input_price_usd_per_million_tokens=settings.gemini_input_usd_per_million_tokens,
        output_price_usd_per_million_tokens=settings.gemini_output_usd_per_million_tokens,
        prices_verified=False,
        prices_note=PRICES_NOTE,
        calls_enabled=False,
        key_configured=_key_configured(),
        spent_usd=spent,
        reserved_usd=reserved,
    )
