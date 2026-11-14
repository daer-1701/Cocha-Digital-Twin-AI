"""Assistant status. This contract does not accept prompts or return model prose."""

from typing import Literal

from pydantic import Field

from cocha_api.schemas.availability import AvailabilityModel

ASSISTANT_REASON = (
    "Gemini calls remain disabled. Model and paid-tier token prices were verified "
    "against Google documentation on 2026-11-14, but live requests still require an "
    "explicit authorization and a configured API key. This endpoint does not call Gemini."
)
PRICES_NOTE = (
    "Paid tier for gemini-3.6-flash: $0.75 input / $3.75 output per 1M tokens through "
    "2026-12-31 (then $1.50 / $7.50). Source: https://ai.google.dev/gemini-api/docs/pricing "
    "checked on 2026-11-14. Project budget default is USD 4, not a verified account balance."
)


class AssistantStatusResponse(AvailabilityModel):
    status: Literal["unavailable"] = "unavailable"
    reason: str
    model: str
    budget_usd: float = Field(gt=0)
    input_price_usd_per_million_tokens: float | None = None
    output_price_usd_per_million_tokens: float | None = None
    prices_verified: bool
    prices_verified_on: str | None = None
    prices_source_url: str | None = None
    prices_note: str
    calls_enabled: Literal[False] = False
    key_configured: bool
    spent_usd: float = Field(ge=0)
    reserved_usd: float = Field(ge=0)
