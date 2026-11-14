"""Backend-only GAMC WMS adapter with allowlists and secret sanitization."""

from __future__ import annotations

import logging
import re
import urllib.error
import urllib.parse
import urllib.request
from collections.abc import Mapping
from dataclasses import dataclass

from cocha_api.science.gamc_catalog import (
    ALLOWED_CRS,
    GAMC_WMS_SERVICE_IDS,
    GAMC_WMS_VERSION,
)
from cocha_api.science.wms_cache import LruBytesCache

logger = logging.getLogger(__name__)

_SECRET_PATTERNS = (
    re.compile(r"(?i)(authorization\s*[:=]\s*)(\S+)"),
    re.compile(r"(?i)([?&]key=)([^&\s]+)"),
    re.compile(r"(?i)(api[_-]?key\s*[:=]\s*)(\S+)"),
)

get_map_cache = LruBytesCache(maxsize=32)


@dataclass(frozen=True)
class WmsUpstreamResult:
    content: bytes
    content_type: str
    status_code: int


class WmsAdapterError(Exception):
    def __init__(self, message: str, status_code: int = 502) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.message = message


def sanitize_error_text(text: str, secret: str | None = None) -> str:
    cleaned = text
    for pattern in _SECRET_PATTERNS:
        cleaned = pattern.sub(r"\1[redacted]", cleaned)
    if secret:
        cleaned = cleaned.replace(secret, "[redacted]")
    return cleaned


def validate_service_id(service_id: str) -> str:
    if service_id not in GAMC_WMS_SERVICE_IDS:
        raise WmsAdapterError("service_id is not in the verified GAMC allowlist", status_code=400)
    return service_id


def validate_crs(crs: str) -> str:
    if crs not in ALLOWED_CRS:
        raise WmsAdapterError("CRS is not allowed", status_code=400)
    return crs


def validate_dimensions(width: int, height: int) -> tuple[int, int]:
    if not 1 <= width <= 2048 or not 1 <= height <= 2048:
        raise WmsAdapterError("width and height must be between 1 and 2048", status_code=400)
    return width, height


def _build_url(endpoint: str, params: Mapping[str, str]) -> str:
    query = urllib.parse.urlencode(params)
    separator = "&" if urllib.parse.urlparse(endpoint).query else "?"
    return f"{endpoint}{separator}{query}"


def _request(
    endpoint: str,
    params: Mapping[str, str],
    api_key: str,
    timeout: float,
) -> WmsUpstreamResult:
    # Project key travels only server-side; never returned to clients.
    upstream_params = {**params, "key": api_key}
    url = _build_url(endpoint, upstream_params)
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": "CochaDigitalTwin/0.1",
            "Accept": "*/*",
            "Authorization": f"Bearer {api_key}",
        },
        method="GET",
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            content = response.read()
            content_type = response.headers.get_content_type() or "application/octet-stream"
            return WmsUpstreamResult(
                content=content,
                content_type=content_type,
                status_code=getattr(response, "status", 200),
            )
    except urllib.error.HTTPError as exc:
        body = sanitize_error_text(exc.read().decode("utf-8", errors="replace"), api_key)
        logger.warning("GAMC WMS upstream HTTP error status=%s", exc.code)
        raise WmsAdapterError(
            sanitize_error_text(f"Upstream WMS error ({exc.code}): {body[:200]}", api_key),
            status_code=502,
        ) from None
    except urllib.error.URLError:
        logger.warning("GAMC WMS upstream network failure")
        raise WmsAdapterError("Upstream WMS unavailable", status_code=502) from None


def get_map(
    *,
    endpoint: str,
    api_key: str,
    service_id: str,
    bbox: str,
    width: int,
    height: int,
    crs: str,
    format: str = "image/png",
    timeout: float = 20.0,
) -> WmsUpstreamResult:
    validate_service_id(service_id)
    validate_crs(crs)
    validate_dimensions(width, height)
    params = {
        "service": "WMS",
        "version": GAMC_WMS_VERSION,
        "request": "GetMap",
        "service_id": service_id,
        "bbox": bbox,
        "width": str(width),
        "height": str(height),
        "srs": crs,
        "format": format,
        "styles": "",
        "transparent": "true",
    }
    cache_key = urllib.parse.urlencode(sorted(params.items()))
    cached = get_map_cache.get(cache_key)
    if cached is not None:
        content, content_type = cached
        return WmsUpstreamResult(content=content, content_type=content_type, status_code=200)
    result = _request(endpoint, params, api_key, timeout)
    get_map_cache.set(cache_key, result.content, result.content_type)
    return result


def get_legend(
    *,
    endpoint: str,
    api_key: str,
    service_id: str,
    format: str = "image/png",
    timeout: float = 20.0,
) -> WmsUpstreamResult:
    validate_service_id(service_id)
    params = {
        "service": "WMS",
        "version": "1.0.0",
        "request": "GetLegendGraphic",
        "service_id": service_id,
        "format": format,
    }
    return _request(endpoint, params, api_key, timeout)


def get_feature_info(
    *,
    endpoint: str,
    api_key: str,
    service_id: str,
    bbox: str,
    width: int,
    height: int,
    x: int,
    y: int,
    crs: str,
    info_format: str = "application/json",
    timeout: float = 20.0,
) -> WmsUpstreamResult:
    validate_service_id(service_id)
    validate_crs(crs)
    validate_dimensions(width, height)
    if not 0 <= x < width or not 0 <= y < height:
        raise WmsAdapterError("x/y must fall within the map pixel bounds", status_code=400)
    params = {
        "service": "WMS",
        "version": GAMC_WMS_VERSION,
        "request": "GetFeatureInfo",
        "service_id": service_id,
        "bbox": bbox,
        "width": str(width),
        "height": str(height),
        "x": str(x),
        "y": str(y),
        "srs": crs,
        "query_layers": service_id,
        "info_format": info_format,
    }
    return _request(endpoint, params, api_key, timeout)
