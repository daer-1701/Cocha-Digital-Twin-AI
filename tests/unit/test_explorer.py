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


def test_domain_snapshot_corruption_is_not_an_empty_dataset(tmp_path):
    import pytest
    from cocha_api.science.evidence import EvidenceUnavailableError, load_snapshot

    assert load_snapshot(tmp_path / "missing.json") is None
    broken = tmp_path / "broken.json"
    broken.write_text("broken")
    with pytest.raises(EvidenceUnavailableError) as failure:
        load_snapshot(broken)
    assert str(failure.value) == "Evidence unavailable"
