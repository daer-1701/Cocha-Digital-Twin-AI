"""HTTP checks against the isolated Linux containers; no satellite network access."""

import os

import httpx
import pytest

pytestmark = pytest.mark.skipif(
    os.getenv("RUN_STACK_TESTS") != "1", reason="Requires isolated compose.test.yaml stack"
)


def test_api_and_standalone_web_without_local_data():
    with httpx.Client(timeout=20) as client:
        assert client.get("http://api:8000/health/ready").status_code == 200
        evidence = client.get("http://api:8000/v1/explorer")
        assert evidence.status_code == 200
        assert evidence.json() == {"status": "empty", "evidence": None}
        web = client.get("http://web:3000")
        assert web.status_code == 200
        assert "Todavía no hay observaciones publicadas" in web.text
        worker = client.get("http://web:3000/maplibre-worker.mjs")
        assert worker.status_code == 200
        assert "MapLibre" in worker.text[:200]
