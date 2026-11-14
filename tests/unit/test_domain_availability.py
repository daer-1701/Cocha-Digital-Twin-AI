from unittest.mock import MagicMock, patch

from cocha_api.main import create_app
from fastapi.testclient import TestClient

UNAVAILABLE_PATHS = (
    "/v1/indicators",
    "/v1/series",
    "/v1/trends",
    "/v1/models",
    "/v1/scenarios",
    "/v1/reports",
)


def _override_empty_session(app):
    session = MagicMock()
    session.scalar.return_value = 0

    def override_session():
        yield session

    from cocha_api.db.session import get_session

    app.dependency_overrides[get_session] = override_session
    return session


def test_domain_endpoints_report_unavailable_without_faking_science(monkeypatch, tmp_path):
    monkeypatch.setenv("EVIDENCE_PATH", str(tmp_path / "missing-snapshot.json"))
    from cocha_api.core.config import get_settings

    get_settings.cache_clear()
    app = create_app()
    _override_empty_session(app)
    reasons = {
        "/v1/indicators": "verified district",
        "/v1/series": "district time series",
        "/v1/trends": "district time series",
        "/v1/models": "pm10",
        "/v1/scenarios": "validated model",
    }
    with TestClient(app) as client:
        for path, fragment in reasons.items():
            response = client.get(path)
            assert response.status_code == 200, path
            body = response.json()
            assert body["status"] == "unavailable", path
            assert body["items"] == [], path
            assert fragment in body["reason"].lower(), path
        reports = client.get("/v1/reports")
        assert reports.status_code == 200
        report_body = reports.json()
        assert report_body["status"] == "empty"
        assert report_body["observation_export"] is None
        assert "snapshot" in report_body["reason"].lower()
        jobs = client.get("/v1/jobs")
    assert jobs.status_code == 200
    assert jobs.json()["status"] == "empty"
    assert jobs.json()["items"] == []
    get_settings.cache_clear()


def test_domain_pagination_bounds():
    session = MagicMock()
    session.scalar.return_value = 0

    def override_session():
        yield session

    app = create_app()
    from cocha_api.db.session import get_session

    app.dependency_overrides[get_session] = override_session
    with TestClient(app) as client:
        for path in (*UNAVAILABLE_PATHS, "/v1/stations", "/v1/jobs"):
            assert client.get(f"{path}?limit=101").status_code == 422
            assert client.get(f"{path}?offset=-1").status_code == 422
            assert client.get(f"{path}?limit=0").status_code == 422


def test_stations_empty_profile_when_database_has_no_rows():
    session = MagicMock()
    session.scalar.return_value = 0

    def override_session():
        yield session

    app = create_app()
    from cocha_api.db.session import get_session

    app.dependency_overrides[get_session] = override_session
    with TestClient(app) as client:
        response = client.get("/v1/stations")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "empty"
    assert body["items"]
    assert all(item["analysis_enabled"] is False for item in body["items"])
    assert "metadata pending" in body["reason"].lower()


def test_territories_exposes_pilot_and_vector_blocker():
    with patch("cocha_api.routes.territories.get_settings") as settings:
        settings.return_value.gamc_wms_api_key = None
        with TestClient(create_app()) as client:
            response = client.get("/v1/territories")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "available"
    assert body["pilot"]["status"] == "available"
    assert body["vector_districts"]["status"] == "unavailable"
    assert "not a complete vector" in body["vector_districts"]["reason"].lower()
    assert "not a gamc boundary" in body["vector_districts"]["reason"].lower()
    assert all(layer["status"] == "unavailable" for layer in body["wms_layers"])


def test_demo_indicators_are_available_and_official_trends_stay_blocked(monkeypatch, tmp_path):
    import json
    from datetime import UTC, datetime
    from types import SimpleNamespace

    from cocha_api.schemas.explorer import Cell, Scene, Snapshot

    west, south, east, north = -66.185, -17.415, -66.176, -17.4
    snapshot = Snapshot(
        generated_at=datetime(2024, 7, 15, tzinfo=UTC),
        area_name="synthetic pilot window",
        bounds=(west, south, east, north),
        product_version="fixture",
        license="fixture",
        method="fixture",
        limitations=["demo rectangles are not districts"],
        scenes=[
            Scene(
                id="fixture-scene",
                acquired_at=datetime(2024, 7, 15, 14, tzinfo=UTC),
                platform="landsat-8",
                source_url="https://example.invalid/item",
                valid_fraction=1,
                valid_pixels=1,
                total_pixels=1,
                lst_mean=21.5,
                ndvi_mean=None,
                cells=[
                    Cell(bounds=(west, south, east, north), lst=21.5, ndvi=None),
                    Cell(bounds=(0.0, 0.0, 1.0, 1.0), lst=0.0, ndvi=0.0),
                ],
            )
        ],
    )
    path = tmp_path / "explorer.json"
    path.write_text(snapshot.model_dump_json(), encoding="utf-8")
    monkeypatch.setenv("EVIDENCE_PATH", str(path))
    from cocha_api.core.config import get_settings

    get_settings.cache_clear()
    ring = [
        [west, south],
        [east, south],
        [east, north],
        [west, north],
        [west, south],
    ]
    row = SimpleNamespace(
        number=1,
        name="Demo 01",
        boundary_version="demo-synthetic-v1",
        geojson=json.dumps(
            {
                "type": "MultiPolygon",
                "coordinates": [[ring]],
            }
        ),
    )
    app = create_app()
    session = _override_empty_session(app)
    session.execute.return_value.all.return_value = [row]
    with TestClient(app) as client:
        indicators = client.get("/v1/indicators")
        trends = client.get("/v1/trends")
        models = client.get("/v1/models")
        scenarios = client.get("/v1/scenarios")
    indicator_body = indicators.json()
    assert indicator_body["status"] == "available"
    assert "official gamc district vector is still missing" in indicator_body["reason"].lower()
    assert indicator_body["items"]
    lst = next(item for item in indicator_body["items"] if item["variable"] == "lst_celsius")
    ndvi = next(item for item in indicator_body["items"] if item["variable"] == "ndvi")
    assert lst["nature"] == "demo_synthetic"
    assert lst["district_indicator"] == "demo"
    assert lst["value"] == 21.5
    assert ndvi["value"] is None
    trend_body = trends.json()
    assert trend_body["status"] == "unavailable"
    assert trend_body["items"] == []
    assert trend_body["demo_trends"]
    assert trend_body["demo_trends"][0]["district_trend"] == "demo"
    assert trend_body["demo_trends"][0]["nature"] == "demo_synthetic"
    assert trend_body["demo_trends"][0]["publishes_inference"] is False
    assert trend_body["pilot_trends"]
    assert trend_body["pilot_trends"][0]["district_trend"] is False
    assert models.json()["status"] == "unavailable"
    assert scenarios.json()["status"] == "unavailable"
    get_settings.cache_clear()
