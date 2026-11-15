import json
from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from cocha_api.core.config import get_settings
from cocha_api.core.pagination import LimitQuery, OffsetQuery
from cocha_api.db.models import District
from cocha_api.db.session import get_session
from cocha_api.schemas.availability import (
    DistrictsResponse,
    OfficialDistrictItem,
    PilotTerritory,
    TerritoriesResponse,
    VectorDistrictsAvailability,
    WmsLayerAvailability,
)
from cocha_api.science.demo_districts import DEMO_BOUNDARY_VERSION
from cocha_api.science.gamc_catalog import (
    GAMC_WMS_LAYERS,
    PILOT_BOUNDS_WGS84,
    VECTOR_DISTRICTS_AVAILABLE,
    VECTOR_DISTRICTS_BLOCKER,
)

router = APIRouter(prefix="/v1/territories", tags=["territories"])

OFFICIAL_DISTRICTS_REASON = (
    "Boundary versions imported from an authorized source. Check source_url and "
    "boundary_version before comparing results across versions."
)
EXPECTED_DISTRICT_COUNT = 15


def _official_boundary_filter():
    return District.boundary_version != DEMO_BOUNDARY_VERSION


def _vector_districts_availability(session: Session) -> VectorDistrictsAvailability:
    """Report official PostGIS districts; never promote demo rectangles."""

    versions = list(
        session.scalars(
            select(District.boundary_version)
            .where(_official_boundary_filter())
            .distinct()
            .order_by(District.boundary_version)
        )
    )
    if not versions:
        return VectorDistrictsAvailability(
            status="unavailable",
            reason=VECTOR_DISTRICTS_BLOCKER,
        )

    selected = versions[0] if len(versions) == 1 else None
    if selected is None:
        return VectorDistrictsAvailability(
            status="empty",
            reason=(
                "Several official boundary versions are imported; pass "
                "boundary_version on /v1/territories/districts before comparing."
            ),
            boundary_versions=versions,
        )

    count = session.scalar(
        select(func.count()).select_from(District).where(District.boundary_version == selected)
    )
    count = int(count or 0)
    if count != EXPECTED_DISTRICT_COUNT:
        return VectorDistrictsAvailability(
            status="empty",
            reason=(
                f"Official boundary_version={selected} has {count} districts; "
                f"expected {EXPECTED_DISTRICT_COUNT} complete municipal polygons."
            ),
            boundary_version=selected,
            boundary_versions=versions,
            count=count,
        )
    return VectorDistrictsAvailability(
        status="available",
        reason=VECTOR_DISTRICTS_AVAILABLE,
        boundary_version=selected,
        boundary_versions=versions,
        count=count,
    )


@router.get("/districts", response_model=DistrictsResponse)
def list_official_districts(
    session: Annotated[Session, Depends(get_session)],
    limit: LimitQuery = 15,
    offset: OffsetQuery = 0,
    boundary_version: Annotated[str | None, Query(min_length=1, max_length=100)] = None,
    include_geometry: bool = False,
) -> DistrictsResponse:
    """Official district boundaries. Demo rectangles are excluded by construction."""

    versions = list(
        session.scalars(
            select(District.boundary_version)
            .where(_official_boundary_filter())
            .distinct()
            .order_by(District.boundary_version)
        )
    )
    if not versions:
        return DistrictsResponse(
            status="unavailable",
            reason=VECTOR_DISTRICTS_BLOCKER,
            limit=limit,
            offset=offset,
        )
    selected = boundary_version or (versions[0] if len(versions) == 1 else None)
    if selected is None or selected not in versions:
        return DistrictsResponse(
            status="empty",
            reason=(
                "Several boundary versions are imported; pass boundary_version."
                if selected is None
                else "Requested boundary_version is not imported."
            ),
            boundary_versions=versions,
            limit=limit,
            offset=offset,
        )
    columns = [
        District.id,
        District.number,
        District.name,
        District.boundary_version,
        District.source_url,
    ]
    if include_geometry:
        columns.append(func.ST_AsGeoJSON(District.geometry).label("geojson"))
    rows = session.execute(
        select(*columns)
        .where(District.boundary_version == selected)
        .order_by(District.number, District.id)
        .limit(limit + 1)
        .offset(offset)
    ).all()
    return DistrictsResponse(
        status="available" if rows else "empty",
        reason=OFFICIAL_DISTRICTS_REASON,
        boundary_version=selected,
        boundary_versions=versions,
        items=[
            OfficialDistrictItem(
                id=row.id,
                number=row.number,
                name=row.name,
                boundary_version=row.boundary_version,
                source_url=row.source_url,
                geometry=json.loads(row.geojson) if include_geometry else None,
            )
            for row in rows[:limit]
        ],
        has_more=len(rows) > limit,
        limit=limit,
        offset=offset,
    )


@router.get("", response_model=TerritoriesResponse)
def territories(
    session: Annotated[Session, Depends(get_session)],
) -> TerritoriesResponse:
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
    vector = _vector_districts_availability(session)
    reason_parts: list[str] = []
    if not key_configured:
        reason_parts.append("WMS layers need GAMC_WMS_API_KEY")
    if vector.status != "available":
        reason_parts.append("official vector districts are not ready for analysis")
    return TerritoriesResponse(
        status="available",
        reason="; ".join(reason_parts) if reason_parts else None,
        pilot=PilotTerritory(
            name="Landsat pilot window",
            bounds_wgs84=PILOT_BOUNDS_WGS84,
            source="data/processed/explorer.json pilot area",
            note="Pilot raster evidence window; not a municipal district boundary.",
        ),
        wms_layers=wms_layers,
        vector_districts=vector,
        generated_at=datetime.now(UTC),
    )
