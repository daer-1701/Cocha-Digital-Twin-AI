from datetime import UTC, datetime

from fastapi import APIRouter

from cocha_api.core.config import get_settings
from cocha_api.schemas.availability import (
    PilotTerritory,
    TerritoriesResponse,
    VectorDistrictsAvailability,
    WmsLayerAvailability,
)
from cocha_api.science.gamc_catalog import (
    GAMC_WMS_LAYERS,
    PILOT_BOUNDS_WGS84,
    VECTOR_DISTRICTS_BLOCKER,
)

router = APIRouter(prefix="/v1/territories", tags=["territories"])


@router.get("", response_model=TerritoriesResponse)
def territories() -> TerritoriesResponse:
    settings = get_settings()
    key_configured = bool(
        settings.gamc_wms_api_key and settings.gamc_wms_api_key.get_secret_value().strip()
    )
    wms_layers = [
        WmsLayerAvailability(
            name=layer["name"],
            service_id=layer["service_id"],
            status="available" if key_configured else "unavailable",
            reason=None
            if key_configured
            else "GAMC_WMS_API_KEY is not configured; WMS proxy will return unavailable.",
        )
        for layer in GAMC_WMS_LAYERS
    ]
    return TerritoriesResponse(
        status="available",
        reason=(
            None
            if key_configured
            else (
                "Pilot area is available; WMS layers need GAMC_WMS_API_KEY; "
                "vector districts blocked."
            )
        ),
        pilot=PilotTerritory(
            name="Landsat pilot window",
            bounds_wgs84=PILOT_BOUNDS_WGS84,
            source="data/processed/explorer.json pilot area",
            note="Pilot raster evidence window; not a municipal district boundary.",
        ),
        wms_layers=wms_layers,
        vector_districts=VectorDistrictsAvailability(reason=VECTOR_DISTRICTS_BLOCKER),
        generated_at=datetime.now(UTC),
    )
