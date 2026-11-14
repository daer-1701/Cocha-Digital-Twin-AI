"""Assistant status. This contract does not accept prompts or return model prose."""

from typing import Literal

from pydantic import Field

from cocha_api.schemas.availability import AvailabilityModel

ASSISTANT_REASON = (
    "Gemini calls are disabled. Configured token prices are placeholders and must be "
    "verified against official Google pricing before any paid request. "
    "This endpoint does not call Gemini."
)
PRICES_NOTE = (
    "input_price_usd_per_million_tokens and output_price_usd_per_million_tokens "
    "are configuration placeholders, not verified official prices."
)


class AssistantStatusResponse(AvailabilityModel):
    status: Literal["unavailable"] = "unavailable"
    reason: str
    model: str
    budget_usd: float = Field(gt=0)
    input_price_usd_per_million_tokens: float | None = None
    output_price_usd_per_million_tokens: float | None = None
    prices_verified: Literal[False] = False
    prices_note: str
    calls_enabled: Literal[False] = False
    key_configured: bool
    spent_usd: float = Field(ge=0)
    reserved_usd: float = Field(ge=0)
