from typing import Annotated, Literal

from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import JSONResponse, Response

from cocha_api.core.config import get_settings
from cocha_api.core.rate_limit import wms_rate_limiter
from cocha_api.science import gamc_wms

router = APIRouter(prefix="/v1/gamc/wms", tags=["gamc-wms"])

CrsQuery = Annotated[Literal["EPSG:4326", "EPSG:3857"], Query()]
DimQuery = Annotated[int, Query(ge=1, le=2048)]


def _enforce_rate_limit(request: Request) -> None:
    settings = get_settings()
    host = request.client.host if request.client else "unknown"
    allowed = wms_rate_limiter.allow(
        host,
        limit=settings.wms_rate_limit_requests,
        window_seconds=settings.wms_rate_limit_window_seconds,
    )
    if not allowed:
        raise HTTPException(
            status_code=429,
            detail={"status": "unavailable", "reason": "WMS proxy rate limit exceeded"},
        )


def _require_api_key() -> tuple[str, str, float]:
    settings = get_settings()
    secret = settings.gamc_wms_api_key
    if secret is None or not secret.get_secret_value().strip():
        raise HTTPException(
            status_code=503,
            detail={
                "status": "unavailable",
                "reason": "GAMC_WMS_API_KEY is not configured",
            },
        )
    return (
        settings.gamc_wms_endpoint,
        secret.get_secret_value().strip(),
        settings.gamc_wms_timeout_seconds,
    )


def _proxy_error(exc: gamc_wms.WmsAdapterError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"status": "unavailable", "reason": exc.message},
    )


@router.get("/map")
def wms_map(
    request: Request,
    service_id: Annotated[str, Query(min_length=1)],
    bbox: Annotated[str, Query(min_length=1)],
    width: DimQuery,
    height: DimQuery,
    crs: CrsQuery = "EPSG:4326",
    format: Annotated[str, Query()] = "image/png",
):
    _enforce_rate_limit(request)
    endpoint, api_key, timeout = _require_api_key()
    try:
        result = gamc_wms.get_map(
            endpoint=endpoint,
            api_key=api_key,
            service_id=service_id,
            bbox=bbox,
            width=width,
            height=height,
            crs=crs,
            format=format,
            timeout=timeout,
        )
    except gamc_wms.WmsAdapterError as exc:
        return _proxy_error(exc)
    return Response(content=result.content, media_type=result.content_type)


@router.get("/legend")
def wms_legend(
    request: Request,
    service_id: Annotated[str, Query(min_length=1)],
    format: Annotated[str, Query()] = "image/png",
):
    _enforce_rate_limit(request)
    endpoint, api_key, timeout = _require_api_key()
    try:
        result = gamc_wms.get_legend(
            endpoint=endpoint,
            api_key=api_key,
            service_id=service_id,
            format=format,
            timeout=timeout,
        )
    except gamc_wms.WmsAdapterError as exc:
        return _proxy_error(exc)
    return Response(content=result.content, media_type=result.content_type)


@router.get("/feature-info")
def wms_feature_info(
    request: Request,
    service_id: Annotated[str, Query(min_length=1)],
    bbox: Annotated[str, Query(min_length=1)],
    width: DimQuery,
    height: DimQuery,
    x: Annotated[int, Query(ge=0)],
    y: Annotated[int, Query(ge=0)],
    crs: CrsQuery = "EPSG:4326",
    info_format: Annotated[str, Query()] = "application/json",
):
    _enforce_rate_limit(request)
    endpoint, api_key, timeout = _require_api_key()
    try:
        result = gamc_wms.get_feature_info(
            endpoint=endpoint,
            api_key=api_key,
            service_id=service_id,
            bbox=bbox,
            width=width,
            height=height,
            x=x,
            y=y,
            crs=crs,
            info_format=info_format,
            timeout=timeout,
        )
    except gamc_wms.WmsAdapterError as exc:
        return _proxy_error(exc)
    return Response(content=result.content, media_type=result.content_type)
