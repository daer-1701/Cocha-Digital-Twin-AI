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
    assert all(layer["status"] == "unavailable" for layer in body["wms_layers"])
