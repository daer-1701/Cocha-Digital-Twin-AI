"""Assistant status and evidence-grounded questions behind role, quota and budget gates."""

import hashlib
import json
import logging
from datetime import UTC, date, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from cocha_api.core.auth import RequireAssistant
from cocha_api.core.config import Settings, get_settings
from cocha_api.core.rate_limit import MemoryRateLimiter
from cocha_api.db.session import get_engine, get_session
from cocha_api.schemas.assistant import (
    ASSISTANT_REASON,
    PRICES_NOTE,
    AskCitation,
    AskRequest,
    AskResponse,
    AssistantStatusResponse,
)
from cocha_api.science.assistant import read_ledger_totals
from cocha_api.science.evidence import load_snapshot
from cocha_api.science.gemini import (
    SYSTEM_INSTRUCTION,
    AnswerCache,
    CentralBudgetLedger,
    EvidenceItem,
    GeminiHttpProvider,
    LiveCallsDisabled,
    ProviderFailure,
    TextProvider,
    build_user_prompt,
    cache_key,
    cited_ids,
    cost_usd,
    district_series_evidence,
    evidence_block,
    snapshot_evidence,
)

router = APIRouter(prefix="/v1", tags=["assistant"])
logger = logging.getLogger(__name__)
assistant_rate_limiter = MemoryRateLimiter()
_cache: AnswerCache | None = None


def _key_configured() -> bool:
    secret = get_settings().gemini_api_key
    return secret is not None and bool(secret.get_secret_value().strip())


def _prices_verified(settings: Settings) -> bool:
    try:
        verified = date.fromisoformat(settings.gemini_prices_verified_on or "")
    except ValueError:
        return False
    today = datetime.now(UTC).date()
    if not 0 <= (today - verified).days <= 30:
        return False
    if verified < date(2027, 1, 1) <= today:
        return False
    return bool(
        settings.gemini_prices_verified_on
        and settings.gemini_prices_source_url
        and settings.gemini_input_usd_per_million_tokens is not None
        and settings.gemini_output_usd_per_million_tokens is not None
        and settings.gemini_model != "unverified-placeholder"
    )


def _live_ready(settings: Settings) -> bool:
    return settings.gemini_calls_enabled and _key_configured() and _prices_verified(settings)


def _central_totals(settings: Settings) -> tuple[float, float]:
    with Session(get_engine()) as session:
        ledger = CentralBudgetLedger(
            session, budget_usd=settings.gemini_budget_usd, model=settings.gemini_model
        )
        return float(ledger.committed_usd()), 0.0


@router.get("/assistant", response_model=AssistantStatusResponse)
def assistant_status() -> AssistantStatusResponse:
    settings = get_settings()
    live = _live_ready(settings)
    reason = ASSISTANT_REASON
    try:
        if live:
            spent, reserved = _central_totals(settings)
        else:
            spent, reserved = read_ledger_totals(
                settings.gemini_ledger_path, settings.gemini_budget_usd
            )
    except SQLAlchemyError:
        logger.error("Central Gemini ledger could not be read")
        spent, reserved, live = 0.0, 0.0, False
        reason = "Gemini calls are disabled. The central budget ledger could not be read."
    except (OSError, ValueError, KeyError, TypeError, json.JSONDecodeError):
        logger.error("Gemini budget ledger could not be read")
        spent, reserved = 0.0, 0.0
        reason = "Gemini calls are disabled. The budget ledger could not be read."
    return AssistantStatusResponse(
        status="available" if live else "unavailable",
        reason=(
            "Answers cite published pilot evidence. Calls consume the project budget."
            if live
            else reason
        ),
        model=settings.gemini_model,
        budget_usd=settings.gemini_budget_usd,
        input_price_usd_per_million_tokens=settings.gemini_input_usd_per_million_tokens,
        output_price_usd_per_million_tokens=settings.gemini_output_usd_per_million_tokens,
        prices_verified=_prices_verified(settings),
        prices_verified_on=settings.gemini_prices_verified_on,
        prices_source_url=settings.gemini_prices_source_url,
        prices_note=PRICES_NOTE,
        calls_enabled=live,
        key_configured=_key_configured(),
        spent_usd=spent,
        reserved_usd=reserved,
        ledger="central_database" if live else "local_file",
    )


def get_text_provider() -> TextProvider:
    """Overridden in identified tests. Raises LiveCallsDisabled unless authorized."""

    settings = get_settings()
    if not _prices_verified(settings):
        raise LiveCallsDisabled("Gemini prices are not verified")
    key = settings.gemini_api_key.get_secret_value() if settings.gemini_api_key else ""
    return GeminiHttpProvider(
        api_key=key,
        model=settings.gemini_model,
        base_url=settings.gemini_api_base_url,
        calls_enabled=settings.gemini_calls_enabled,
    )


def _answer_cache(settings: Settings) -> AnswerCache:
    global _cache
    if _cache is None or _cache.max_entries != settings.gemini_cache_entries:
        _cache = AnswerCache(settings.gemini_cache_entries)
    return _cache


def _unavailable(request_id: str, reason: str) -> AskResponse:
    return AskResponse(status="unavailable", reason=reason, request_id=request_id)


@router.post("/assistant/ask", response_model=AskResponse)
def ask_assistant(
    payload: AskRequest,
    _: RequireAssistant,
    session: Annotated[Session, Depends(get_session)],
    x_cocha_client: Annotated[str | None, Header(max_length=200)] = None,
) -> AskResponse:
    """Server-to-server only. The web server holds API_ASSISTANT_TOKEN, never the browser."""

    settings = get_settings()
    if len(payload.question) > settings.gemini_max_question_chars:
        raise HTTPException(
            status_code=422,
            detail=f"question exceeds {settings.gemini_max_question_chars} characters",
        )
    try:
        provider = get_text_provider()
    except LiveCallsDisabled:
        return _unavailable(payload.request_id, "Gemini calls are disabled on this server.")

    ledger = CentralBudgetLedger(
        session, budget_usd=settings.gemini_budget_usd, model=settings.gemini_model
    )
    previous = ledger.existing(payload.request_id)
    if previous is not None:
        if previous.response is None:
            raise HTTPException(status_code=409, detail="request_id is still in progress")
        return AskResponse.model_validate({**previous.response, "replayed": True})

    client = hashlib.sha256((x_cocha_client or "anonymous").encode("utf-8")).hexdigest()[:16]
    for key in (f"client:{client}", "global"):
        allowed = assistant_rate_limiter.allow(
            key,
            limit=settings.gemini_rate_limit_requests,
            window_seconds=settings.gemini_rate_limit_window_seconds,
        )
        if not allowed:
            raise HTTPException(status_code=429, detail="Assistant quota exhausted; retry later")

    if (payload.district_number is None) ^ (payload.boundary_version is None):
        raise HTTPException(
            status_code=422,
            detail="district_number and boundary_version must be provided together",
        )
    evidence_items = snapshot_evidence(load_snapshot(settings.evidence_path))
    if payload.district_number is not None and payload.boundary_version is not None:
        evidence_items = [
            *district_series_evidence(
                session,
                district_number=payload.district_number,
                boundary_version=payload.boundary_version,
                start_id=1,
            ),
            *evidence_items,
        ]
        evidence_items = [
            EvidenceItem(
                id=f"E{index}",
                kind=item.kind,
                title=item.title,
                source=item.source,
                text=item.text,
            )
            for index, item in enumerate(evidence_items, start=1)
        ]
    evidence_text, evidence = evidence_block(
        evidence_items,
        settings.gemini_max_context_chars,
    )
    if not evidence:
        return _unavailable(payload.request_id, "No published evidence is available to cite.")
    user_prompt = build_user_prompt(payload.question, evidence_text)
    key = cache_key(
        settings.gemini_model, SYSTEM_INSTRUCTION, user_prompt, settings.gemini_max_output_tokens
    )
    cached = _answer_cache(settings).get(key)
    if cached is not None:
        return AskResponse.model_validate(
            {**cached, "request_id": payload.request_id, "cached": True}
        )

    input_bound = len((SYSTEM_INSTRUCTION + user_prompt).encode("utf-8")) + 1024
    conservative_cost = (
        input_bound * (settings.gemini_input_usd_per_million_tokens or 0.0)
        + settings.gemini_max_output_tokens * (settings.gemini_output_usd_per_million_tokens or 0.0)
    ) / 1_000_000
    outcome = ledger.reserve(
        payload.request_id, max(settings.gemini_reserve_usd_per_request, conservative_cost)
    )
    if outcome == "duplicate":
        raise HTTPException(status_code=409, detail="request_id is still in progress")
    if outcome == "exceeded":
        return AskResponse(
            status="rejected", reason="budget_exceeded", request_id=payload.request_id
        )

    try:
        completion = provider.generate(
            system=SYSTEM_INSTRUCTION,
            user=user_prompt,
            max_output_tokens=settings.gemini_max_output_tokens,
            timeout_seconds=settings.gemini_timeout_seconds,
        )
    except ProviderFailure as failure:
        logger.warning("Gemini provider failed: %s", failure)
        response = AskResponse(
            status="error", reason="provider_failed", request_id=payload.request_id
        )
        ledger.reconcile(
            payload.request_id,
            actual_usd=None,
            input_tokens=None,
            output_tokens=None,
            response=response.model_dump(mode="json"),
        )
        return response

    valid, unknown = cited_ids(completion.text, evidence)
    by_id = {item.id: item for item in evidence}
    grounded = bool(valid) and not unknown
    response = AskResponse(
        status="answered" if grounded else "ungrounded",
        reason=None if grounded else "Answer withheld: missing or unknown evidence citations.",
        request_id=payload.request_id,
        answer=completion.text if grounded else None,
        citations=[
            AskCitation(
                id=item_id,
                kind=by_id[item_id].kind,
                title=by_id[item_id].title,
                source=by_id[item_id].source,
            )
            for item_id in valid
        ],
        model=settings.gemini_model,
        provider=provider.provider_id,
    )
    actual = cost_usd(
        completion,
        settings.gemini_input_usd_per_million_tokens or 0.0,
        settings.gemini_output_usd_per_million_tokens or 0.0,
    )
    ledger.reconcile(
        payload.request_id,
        actual_usd=actual,
        input_tokens=completion.input_tokens,
        output_tokens=completion.output_tokens,
        response=response.model_dump(mode="json"),
    )
    if grounded:
        _answer_cache(settings).put(key, response.model_dump(mode="json", exclude={"request_id"}))
    return response
