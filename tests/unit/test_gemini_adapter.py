"""Gemini adapter guards. Identified fake providers only; no network calls."""

from datetime import UTC, datetime
from unittest.mock import MagicMock

import pytest
from cocha_api.core.config import Settings, get_settings
from cocha_api.main import create_app
from cocha_api.science.gemini import (
    Completion,
    EvidenceItem,
    GeminiHttpProvider,
    LiveCallsDisabled,
    ProviderFailure,
    cited_ids,
    cost_usd,
    evidence_block,
    parse_generate_content,
)
from fastapi.testclient import TestClient

EVIDENCE = [
    EvidenceItem("E1", "observation", "Escena A", "https://example.invalid/a", "LST 30 °C"),
    EvidenceItem("E2", "demo", "Rectángulo demo", "fixture", "No es un distrito"),
]


@pytest.mark.parametrize(
    ("today", "verified_on", "expected"),
    [
        ("2026-11-15", "2026-11-14", True),
        ("2026-11-15", "2026-10-15", False),
        ("2026-11-15", "2026-11-16", False),
        ("2026-11-15", "not-a-date", False),
        ("2027-01-01", "2026-12-31", False),
    ],
)
def test_price_verification_expires_and_rejects_future_dates(
    monkeypatch, today, verified_on, expected
):
    from cocha_api.routes import assistant

    clock = MagicMock()
    clock.now.return_value = datetime.fromisoformat(today).replace(tzinfo=UTC)
    monkeypatch.setattr(assistant, "datetime", clock)
    settings = Settings(
        _env_file=None,
        gemini_model="identified-test-model",
        gemini_prices_verified_on=verified_on,
        gemini_prices_source_url="https://example.invalid/pricing",
        gemini_input_usd_per_million_tokens=1,
        gemini_output_usd_per_million_tokens=2,
    )
    assert assistant._prices_verified(settings) is expected


def test_live_provider_cannot_be_built_while_calls_are_disabled():
    with pytest.raises(LiveCallsDisabled):
        GeminiHttpProvider(
            api_key="not-a-real-key",
            model="any",
            base_url="https://example.invalid",
            calls_enabled=False,
        )
    with pytest.raises(LiveCallsDisabled):
        GeminiHttpProvider(
            api_key="not-a-real-key",
            model="any",
            base_url="http://example.invalid",
            calls_enabled=True,
        )


def test_citations_must_point_to_supplied_evidence():
    valid, unknown = cited_ids("Dato [E1], repetido [E1], inventado [E9].", EVIDENCE)
    assert valid == ["E1"]
    assert unknown == ["E9"]
    alt_valid, alt_unknown = cited_ids("También (E1) sin corchetes inventados.", EVIDENCE)
    assert alt_valid == ["E1"]
    assert alt_unknown == []


def test_evidence_block_stops_before_the_character_limit():
    text, included = evidence_block(EVIDENCE, max_chars=80)
    assert len(text) <= 80
    assert [item.id for item in included] == ["E1"]


def test_provider_payload_is_validated_and_thinking_counts_as_output():
    completion = parse_generate_content(
        {
            "candidates": [{"content": {"parts": [{"text": "Respuesta [E1]"}]}}],
            "usageMetadata": {
                "promptTokenCount": 1000,
                "candidatesTokenCount": 100,
                "thoughtsTokenCount": 50,
            },
        }
    )
    assert completion.output_tokens == 150
    assert cost_usd(completion, 0.75, 3.75) == pytest.approx((1000 * 0.75 + 150 * 3.75) / 1e6)
    with pytest.raises(ProviderFailure):
        parse_generate_content({"candidates": []})


def test_thinking_parts_are_excluded_from_visible_answer():
    completion = parse_generate_content(
        {
            "candidates": [
                {
                    "content": {
                        "parts": [
                            {"text": "scratch [E9]", "thought": True},
                            {"text": "Respuesta visible [E1]."},
                        ]
                    }
                }
            ],
            "usageMetadata": {
                "promptTokenCount": 10,
                "candidatesTokenCount": 8,
                "thoughtsTokenCount": 20,
            },
        }
    )
    assert completion.text == "Respuesta visible [E1]."
    assert completion.output_tokens == 28


def test_unknown_usage_leaves_cost_unknown():
    assert cost_usd(Completion("x", None, 10), 1.0, 1.0) is None


def test_ask_route_requires_role_and_stays_unavailable_without_authorization(monkeypatch):
    token = "assistant-token-for-tests-0123456789"
    monkeypatch.setenv("API_ASSISTANT_TOKEN", token)
    monkeypatch.setenv("GEMINI_CALLS_ENABLED", "false")
    get_settings.cache_clear()
    app = create_app()
    from cocha_api.db.session import get_session

    session = MagicMock()
    app.dependency_overrides[get_session] = lambda: session
    body = {"request_id": "req-00000001", "question": "¿Qué muestra la escena?"}
    try:
        with TestClient(app) as client:
            assert client.post("/v1/assistant/ask", json=body).status_code == 401
            wrong = {"Authorization": "Bearer wrong-token-0123456789-abcdef"}
            assert client.post("/v1/assistant/ask", json=body, headers=wrong).status_code == 403
            response = client.post(
                "/v1/assistant/ask", json=body, headers={"Authorization": f"Bearer {token}"}
            )
        assert response.status_code == 200
        assert response.json()["status"] == "unavailable"
        session.execute.assert_not_called()
    finally:
        get_settings.cache_clear()
