from unittest.mock import patch

from cocha_api.core.config import Settings
from cocha_api.main import create_app
from fastapi.testclient import TestClient


def test_missing_snapshot_is_empty_not_fake(tmp_path):
    settings = Settings(evidence_path=tmp_path / "missing.json")
    with patch("cocha_api.routes.explorer.get_settings", return_value=settings):
        with TestClient(create_app()) as client:
            response = client.get("/v1/explorer")
    assert response.status_code == 200
    assert response.json() == {"status": "empty", "evidence": None}


def test_corrupt_snapshot_returns_sanitized_failure(tmp_path):
    path = tmp_path / "private-file.json"
    path.write_text('{"secret": "private-content"}')
    with patch("cocha_api.routes.explorer.get_settings", return_value=Settings(evidence_path=path)):
        with TestClient(create_app()) as client:
            response = client.get("/v1/explorer")
    assert response.status_code == 503
    assert response.json() == {"detail": "Evidence unavailable"}
