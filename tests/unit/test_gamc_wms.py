from unittest.mock import MagicMock, patch

import pytest
from cocha_api.core.config import get_settings
from cocha_api.core.rate_limit import wms_rate_limiter
from cocha_api.main import create_app
from cocha_api.science import gamc_wms
from cocha_api.science.wms_cache import LruBytesCache
from fastapi.testclient import TestClient


@pytest.fixture(autouse=True)
def clear_settings_and_cache():
    get_settings.cache_clear()
    gamc_wms.get_map_cache.clear()
    wms_rate_limiter.clear()
    yield
    get_settings.cache_clear()
    gamc_wms.get_map_cache.clear()
    wms_rate_limiter.clear()


def test_wms_endpoints_unavailable_without_api_key(monkeypatch):
    # An empty variable overrides a key in a local .env file.
    monkeypatch.setenv("GAMC_WMS_API_KEY", "")
    get_settings.cache_clear()
    with TestClient(create_app()) as client:
        response = client.get(
            "/v1/gamc/wms/map",
            params={
                "service_id": "7eb13092-bf0e-493b-aae6-03c43eedda2c",
                "bbox": "-66.3,-17.6,-66.0,-17.2",
                "width": 256,
                "height": 256,
            },
        )
    assert response.status_code == 503
    body = response.json()
    assert body["detail"]["status"] == "unavailable"
    assert "GAMC_WMS_API_KEY" in body["detail"]["reason"]


def test_wms_rejects_unknown_service_id(monkeypatch):
    monkeypatch.setenv("GAMC_WMS_API_KEY", "test-secret-key")
    get_settings.cache_clear()
    with TestClient(create_app()) as client:
        response = client.get(
            "/v1/gamc/wms/map",
            params={
                "service_id": "not-in-allowlist",
                "bbox": "-66.3,-17.6,-66.0,-17.2",
                "width": 256,
                "height": 256,
            },
        )
    assert response.status_code == 400
    assert "allowlist" in response.json()["reason"].lower()


def test_wms_map_proxies_with_mocked_urllib(monkeypatch):
    monkeypatch.setenv("GAMC_WMS_API_KEY", "test-secret-key")
    get_settings.cache_clear()

    fake_response = MagicMock()
    fake_response.read.return_value = b"png-bytes"
    fake_response.headers.get_content_type.return_value = "image/png"
    fake_response.status = 200
    fake_response.__enter__.return_value = fake_response
    fake_response.__exit__.return_value = None

    with patch(
        "cocha_api.science.gamc_wms.urllib.request.urlopen", return_value=fake_response
    ) as urlopen:
        with TestClient(create_app()) as client:
            response = client.get(
                "/v1/gamc/wms/map",
                params={
                    "service_id": "7eb13092-bf0e-493b-aae6-03c43eedda2c",
                    "bbox": "-66.3,-17.6,-66.0,-17.2",
                    "width": 128,
                    "height": 128,
                    "crs": "EPSG:4326",
                },
            )
            # Identical query should hit cache and not call upstream again.
            cached = client.get(
                "/v1/gamc/wms/map",
                params={
                    "service_id": "7eb13092-bf0e-493b-aae6-03c43eedda2c",
                    "bbox": "-66.3,-17.6,-66.0,-17.2",
                    "width": 128,
                    "height": 128,
                    "crs": "EPSG:4326",
                },
            )
    assert response.status_code == 200
    assert response.content == b"png-bytes"
    assert response.headers["content-type"].startswith("image/png")
    assert cached.content == b"png-bytes"
    assert urlopen.call_count == 1
    request = urlopen.call_args.args[0]
    assert "test-secret-key" in request.full_url
    assert request.get_header("Authorization") == "Bearer test-secret-key"


def test_sanitize_error_text_redacts_secrets():
    text = "Authorization: Bearer super-secret key=super-secret failed"
    cleaned = gamc_wms.sanitize_error_text(text, secret="super-secret")
    assert "super-secret" not in cleaned
    assert "[redacted]" in cleaned


def test_lru_bytes_cache_evicts_oldest():
    cache = LruBytesCache(maxsize=2)
    cache.set("a", b"1", "image/png")
    cache.set("b", b"2", "image/png")
    cache.set("c", b"3", "image/png")
    assert cache.get("a") is None
    assert cache.get("b") == (b"2", "image/png")


def test_dimension_and_crs_validation():
    with pytest.raises(gamc_wms.WmsAdapterError):
        gamc_wms.validate_dimensions(0, 10)
    with pytest.raises(gamc_wms.WmsAdapterError):
        gamc_wms.validate_dimensions(10, 3000)
    with pytest.raises(gamc_wms.WmsAdapterError):
        gamc_wms.validate_crs("EPSG:9999")


def test_legend_and_feature_info_mocked(monkeypatch):
    monkeypatch.setenv("GAMC_WMS_API_KEY", "test-secret-key")
    get_settings.cache_clear()
    fake_response = MagicMock()
    fake_response.read.return_value = b'{"ok":true}'
    fake_response.headers.get_content_type.return_value = "application/json"
    fake_response.status = 200
    fake_response.__enter__.return_value = fake_response
    fake_response.__exit__.return_value = None

    with patch("cocha_api.science.gamc_wms.urllib.request.urlopen", return_value=fake_response):
        with TestClient(create_app()) as client:
            legend = client.get(
                "/v1/gamc/wms/legend",
                params={"service_id": "7eb13092-bf0e-493b-aae6-03c43eedda2c"},
            )
            info = client.get(
                "/v1/gamc/wms/feature-info",
                params={
                    "service_id": "7eb13092-bf0e-493b-aae6-03c43eedda2c",
                    "bbox": "-66.3,-17.6,-66.0,-17.2",
                    "width": 100,
                    "height": 100,
                    "x": 10,
                    "y": 10,
                },
            )
    assert legend.status_code == 200
    assert info.status_code == 200
    assert b"ok" in info.content


def test_territories_marks_wms_available_when_key_configured(monkeypatch):
    monkeypatch.setenv("GAMC_WMS_API_KEY", "configured")
    get_settings.cache_clear()
    with TestClient(create_app()) as client:
        body = client.get("/v1/territories").json()
    assert all(layer["status"] == "available" for layer in body["wms_layers"])
    assert body["vector_districts"]["status"] == "unavailable"
