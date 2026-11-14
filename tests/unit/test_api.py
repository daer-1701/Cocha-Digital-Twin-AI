from unittest.mock import patch

import pytest
from cocha_api.db.migrations import expected_revision
from cocha_api.main import create_app
from fastapi.testclient import TestClient
from sqlalchemy.exc import OperationalError


def test_liveness_does_not_require_database():
    with TestClient(create_app()) as client:
        response = client.get("/health/live")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "cocha-api"}


def test_readiness_failure_does_not_leak_credentials():
    with patch("cocha_api.routes.health.get_engine") as engine:
        engine.return_value.connect.side_effect = OperationalError(
            "secret-query", {}, Exception("private-password")
        )
        with TestClient(create_app()) as client:
            response = client.get("/health/ready")
    assert response.status_code == 503
    assert response.json() == {"status": "not_ready"}


def test_dataset_pagination_is_bounded():
    with TestClient(create_app()) as client:
        assert client.get("/v1/datasets?limit=101").status_code == 422
        assert client.get("/v1/datasets?offset=-1").status_code == 422


def test_cors_rejects_unconfigured_origin():
    with TestClient(create_app()) as client:
        response = client.get("/health/live", headers={"Origin": "https://untrusted.example"})
    assert "access-control-allow-origin" not in response.headers


@pytest.mark.parametrize("revision_mode,status_code", [("match", 200), ("obsolete", 503)])
def test_readiness_requires_current_migration(revision_mode, status_code):
    revision = expected_revision() if revision_mode == "match" else "obsolete"
    with patch("cocha_api.routes.health.get_engine") as engine:
        connection = engine.return_value.connect.return_value.__enter__.return_value
        connection.execute.return_value.scalar_one.return_value = revision
        with TestClient(create_app()) as client:
            response = client.get("/health/ready")
    assert response.status_code == status_code
