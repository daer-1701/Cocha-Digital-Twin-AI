"""Assistant contracts. Answers are generated explanations of cited evidence."""

from typing import Literal

from pydantic import Field

from cocha_api.schemas.availability import AvailabilityModel

ASSISTANT_REASON = (
    "Gemini calls remain disabled. Model and paid-tier token prices were verified "
    "against Google documentation on 2026-11-15, but live requests still require an "
    "explicit authorization and a configured API key. This endpoint does not call Gemini."
)
PRICES_NOTE = (
    "Paid tier for gemini-3.6-flash: $0.75 input / $3.75 output per 1M tokens through "
    "2026-12-31 (then $1.50 / $7.50). Source: https://ai.google.dev/gemini-api/docs/pricing "
    "checked on 2026-11-15. Project budget default is USD 4, not a verified account balance."
)


class AssistantStatusResponse(AvailabilityModel):
    # 'available' only with GEMINI_CALLS_ENABLED, a key and verified prices.
    status: Literal["available", "unavailable"] = "unavailable"
    reason: str
    model: str
    budget_usd: float = Field(gt=0)
    input_price_usd_per_million_tokens: float | None = None
    output_price_usd_per_million_tokens: float | None = None
    prices_verified: bool
    prices_verified_on: str | None = None
    prices_source_url: str | None = None
    prices_note: str
    calls_enabled: bool = False
    key_configured: bool
    spent_usd: float = Field(ge=0)
    reserved_usd: float = Field(ge=0)
    ledger: Literal["local_file", "central_database"] = "local_file"


class AskRequest(AvailabilityModel):
    # Client-generated id; retrying with the same id never pays twice.
    request_id: str = Field(pattern=r"^[A-Za-z0-9_-]{8,100}$")
    question: str = Field(min_length=3, max_length=4000)
    # Optional district scope: the server loads accepted series; client numbers are not trusted.
    district_number: int | None = Field(default=None, ge=1, le=15)
    boundary_version: str | None = Field(default=None, min_length=1, max_length=100)


class AskCitation(AvailabilityModel):
    id: str
    kind: Literal["observation", "estimate", "scenario", "demo"]
    title: str
    source: str


class AskResponse(AvailabilityModel):
    status: Literal["answered", "ungrounded", "unavailable", "rejected", "error"]
    reason: str | None = None
    request_id: str
    answer: str | None = None
    citations: list[AskCitation] = Field(default_factory=list)
    nature: Literal["generated_explanation"] = "generated_explanation"
    model: str | None = None
    provider: str | None = None
    cached: bool = False
    replayed: bool = False
