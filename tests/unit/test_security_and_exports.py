"""HTTP envelopes for jobs, exports, assistant status, and secret handling."""

import json
from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import MagicMock
from uuid import uuid4

from cocha_api.core.config import get_settings
from cocha_api.core.rate_limit import wms_rate_limiter
from cocha_api.main import create_app
from cocha_api.schemas.explorer import Scene, Snapshot
from fastapi.testclient import TestClient


def _session_app(scalar_value: int, rows: list[object] | None = None):
    session = MagicMock()
    session.scalar.return_value = scalar_value
    session.scalars.return_value.all.return_value = rows or []
    session.get.return_value = None

    def override_session():
        yield session

    app = create_app()
    from cocha_api.db.session import get_session

    app.dependency_overrides[get_session] = override_session
    return app, session


def _snapshot(lst_mean: float | None) -> Snapshot:
    return Snapshot(
        generated_at=datetime(2024, 7, 15, tzinfo=UTC),
        area_name="synthetic pilot window",
        bounds=(0.0, 0.0, 1.0, 1.0),
        product_version="fixture",
        license="fixture",
        method="fixture",
        limitations=["not a district"],
        scenes=[
            Scene(
                id="fixture-scene",
                acquired_at=datetime(2024, 7, 15, 14, tzinfo=UTC),
                platform="landsat-8",
                source_url="https://example.invalid/item",
                valid_fraction=0.5,
                valid_pixels=1,
                total_pixels=2,
                lst_mean=lst_mean,
                ndvi_mean=0.2,
                cells=[],
            )
        ],
    )


def test_jobs_list_and_missing_id(monkeypatch, tmp_path):
    monkeypatch.setenv("EVIDENCE_PATH", str(tmp_path / "missing.json"))
    get_settings.cache_clear()
    job_id = uuid4()
    row = SimpleNamespace(
        id=job_id,
        kind="landsat_pilot",
        status="succeeded",
        started_at=None,
        finished_at=None,
    )
    app, session = _session_app(1, [row])
    session.get.return_value = None
    with TestClient(app) as client:
        listed = client.get("/v1/jobs")
        missing = client.get(f"/v1/jobs/{uuid4()}")
    assert listed.status_code == 200
    body = listed.json()
    assert body["status"] == "available"
    assert body["items"][0]["id"] == str(job_id)
    assert body["items"][0]["kind"] == "landsat_pilot"
    assert "parameters" not in body["items"][0]
    assert missing.status_code == 404
    assert missing.json()["detail"]["status"] == "empty"
    get_settings.cache_clear()


def test_indicators_and_reports_label_pilot_window(monkeypatch, tmp_path):
    path = tmp_path / "explorer.json"
    path.write_text(_snapshot(None).model_dump_json(), encoding="utf-8")
    monkeypatch.setenv("EVIDENCE_PATH", str(path))
    get_settings.cache_clear()
    app, _session = _session_app(0)
    with TestClient(app) as client:
        indicators = client.get("/v1/indicators")
        reports = client.get("/v1/reports")
        trends = client.get("/v1/trends")
        models = client.get("/v1/models")
    indicator_body = indicators.json()
    assert indicator_body["status"] == "unavailable"
    assert indicator_body["items"] == []
    assert indicator_body["pilot_window"]["label"] == "pilot-only"
    assert indicator_body["pilot_window"]["scenes"][0]["lst_mean"] is None
    assert indicator_body["pilot_window"]["scenes"][0]["district_indicator"] is False
    report_body = reports.json()
    assert report_body["status"] == "available"
    export = report_body["observation_export"]
    assert export["kind"] == "observation_export"
    assert export["district_report"] is False
    assert export["evidence"]["scenes"][0]["lst_mean"] is None
    trend_body = trends.json()
    assert trend_body["status"] == "unavailable"
    assert trend_body["items"] == []
    assert len(trend_body["pilot_trends"]) == 2
    assert trend_body["pilot_trends"][0]["district_trend"] is False
    assert trend_body["pilot_trends"][0]["publishes_inference"] is False
    model_body = models.json()
    assert model_body["status"] == "unavailable"
    assert model_body["items"] == []
    assert model_body["viability_note"]
    assert any("PM10" in blocker for blocker in model_body["blockers"])
    get_settings.cache_clear()


def test_assistant_status_does_not_leak_the_key_or_call_gemini(monkeypatch, tmp_path):
    secret = "super-secret-gemini-key"
    ledger = tmp_path / "ledger.json"
    monkeypatch.setenv("GEMINI_API_KEY", secret)
    monkeypatch.setenv("GEMINI_LEDGER_PATH", str(ledger))
    monkeypatch.setenv("GEMINI_BUDGET_USD", "4")
    monkeypatch.setenv("GEMINI_MODEL", "unverified-placeholder")
    get_settings.cache_clear()
    with TestClient(create_app()) as client:
        response = client.get("/v1/assistant")
        rejected = client.post("/v1/assistant")
    assert response.status_code == 200
    assert rejected.status_code == 405
    body = response.json()
    assert body["calls_enabled"] is False
    assert body["prices_verified"] is False
    assert body["key_configured"] is True
    assert body["budget_usd"] == 4
    assert secret not in response.text
    assert not ledger.exists()
    get_settings.cache_clear()


def test_verified_prices_stay_visible_while_calls_stay_off(monkeypatch, tmp_path):
    monkeypatch.setenv("GEMINI_MODEL", "gemini-3.6-flash")
    monkeypatch.setenv("GEMINI_INPUT_USD_PER_MILLION_TOKENS", "0.75")
    monkeypatch.setenv("GEMINI_OUTPUT_USD_PER_MILLION_TOKENS", "3.75")
    monkeypatch.setenv("GEMINI_PRICES_VERIFIED_ON", "2026-11-14")
    monkeypatch.setenv("GEMINI_PRICES_SOURCE_URL", "https://ai.google.dev/gemini-api/docs/pricing")
    monkeypatch.setenv("GEMINI_LEDGER_PATH", str(tmp_path / "ledger.json"))
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    get_settings.cache_clear()
    with TestClient(create_app()) as client:
        body = client.get("/v1/assistant").json()
    assert body["status"] == "unavailable"
    assert body["calls_enabled"] is False
    assert body["prices_verified"] is True
    assert body["input_price_usd_per_million_tokens"] == 0.75
    assert body["output_price_usd_per_million_tokens"] == 3.75
    assert "disabled" in body["reason"].lower()
    assert "authorization" in body["reason"].lower()
    get_settings.cache_clear()


def test_corrupt_ledger_does_not_echo_file_contents(monkeypatch, tmp_path):
    secret = "super-secret-gemini-key"
    ledger = tmp_path / "ledger.json"
    ledger.write_text(secret, encoding="utf-8")
    monkeypatch.setenv("GEMINI_LEDGER_PATH", str(ledger))
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    get_settings.cache_clear()
    with TestClient(create_app()) as client:
        response = client.get("/v1/assistant")
    assert response.status_code == 200
    assert "ledger" in response.json()["reason"].lower()
    assert secret not in response.text
    get_settings.cache_clear()


def test_wms_rate_limit_and_upstream_error_omit_the_key(monkeypatch):
    import urllib.error
    from email.message import Message
    from io import BytesIO
    from unittest.mock import patch

    secret = "test-secret-key"
    monkeypatch.setenv("GAMC_WMS_API_KEY", secret)
    monkeypatch.setenv("WMS_RATE_LIMIT_REQUESTS", "1")
    monkeypatch.setenv("WMS_RATE_LIMIT_WINDOW_SECONDS", "60")
    get_settings.cache_clear()
    wms_rate_limiter.clear()
    error = urllib.error.HTTPError(
        url=f"https://example.invalid/?key={secret}",
        code=500,
        msg="bad",
        hdrs=Message(),
        fp=BytesIO(f"failed key={secret}".encode()),
    )
    params = {
        "service_id": "7eb13092-bf0e-493b-aae6-03c43eedda2c",
        "bbox": "-66.3,-17.6,-66.0,-17.2",
        "width": 64,
        "height": 64,
    }
    with patch("cocha_api.science.gamc_wms.urllib.request.urlopen", side_effect=error) as urlopen:
        with TestClient(create_app()) as client:
            failed = client.get("/v1/gamc/wms/map", params=params)
            limited = client.get("/v1/gamc/wms/map", params=params)
    assert failed.status_code == 502
    assert secret not in failed.text
    assert limited.status_code == 429
    assert secret not in limited.text
    assert urlopen.call_count == 1
    assert json.loads(limited.text)["detail"]["reason"]
    get_settings.cache_clear()
    wms_rate_limiter.clear()
