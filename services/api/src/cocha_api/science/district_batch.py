"""Persist district indicators from a verified local Landsat replay."""

import hashlib
import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from uuid import NAMESPACE_URL, uuid5

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from cocha_api.db.models import District, DistrictIndicator, ProcessingRun
from cocha_api.science.demo_districts import DEMO_BOUNDARY_VERSION, DEMO_SOURCE
from cocha_api.science.landsat import (
    PILOT_BOUNDS_WGS84,
    PILOT_METHOD,
    STAC_ROOT,
    read_scene_grids,
    scene_manifest,
)
from cocha_api.science.zonal import district_raster_means

RUN_KIND = "landsat_district_indicators"
PRODUCT = "USGS Landsat Collection 2 Level-2"
PRODUCT_VERSION = "02"
QA_MASK = "QA_PIXEL bits 0-5 excluded; QA_RADSAT=0; shared valid LST/NDVI mask"


def persist_district_batch(
    session: Session,
    inputs: list[tuple[dict[str, Any], Path]],
    *,
    boundary_version: str,
    commit: str,
) -> int:
    """Write a complete batch within the caller's transaction; return new rows."""
    if not inputs or not boundary_version.strip() or boundary_version == DEMO_BOUNDARY_VERSION:
        raise ValueError("Require verified Landsat inputs and a non-demo boundary version")
    districts = session.scalars(
        select(District)
        .where(District.boundary_version == boundary_version)
        .order_by(District.number)
        .with_for_update(read=True)
    ).all()
    if len(districts) != 15 or any(
        not district.source_url.strip() or district.source_url == DEMO_SOURCE
        for district in districts
    ):
        raise ValueError("Require all 15 official districts imported with the requested version")

    parameters = {
        "boundary_version": boundary_version,
        "method": PILOT_METHOD,
        "districts": [
            {
                "id": str(district.id),
                "source": district.source_url,
                "geometry_sha256": hashlib.sha256(district.geometry.data).hexdigest(),
            }
            for district in districts
        ],
        "scenes": [scene_manifest(folder, item) for item, folder in inputs],
    }
    identity = json.dumps([RUN_KIND, commit, parameters], sort_keys=True)
    run_id = uuid5(NAMESPACE_URL, identity)
    started_at = datetime.now(UTC)
    claimed = session.scalar(
        insert(ProcessingRun)
        .values(
            id=run_id,
            kind=RUN_KIND,
            status="running",
            git_commit=commit,
            parameters=parameters,
            started_at=started_at,
        )
        .on_conflict_do_nothing(index_elements=[ProcessingRun.id])
        .returning(ProcessingRun.id)
    )
    if claimed is None:
        return 0

    count = 0
    for item, folder in inputs:
        lst, ndvi, grid, crs = read_scene_grids(None, item, folder)
        srid = crs.to_epsg()
        if (
            srid is None
            or not crs.is_projected
            or crs.linear_units_factor[1] != 1
            or grid.b != 0
            or grid.d != 0
            or grid.a <= 0
            or grid.e >= 0
        ):
            raise ValueError("Require a north-up raster in an EPSG projected metre CRS")
        period = datetime.fromisoformat(item["properties"]["datetime"]).astimezone(UTC).date()
        manifest = scene_manifest(folder, item)
        scene_id = str(item["id"])
        source_url = f"{STAC_ROOT}/collections/landsat-c2-l2/items/{scene_id}"
        for district in districts:
            wkt = session.scalar(
                select(func.ST_AsText(func.ST_Transform(District.geometry, srid))).where(
                    District.id == district.id
                )
            )
            lst_mean, ndvi_mean = district_raster_means(
                session,
                district_wkt=wkt,
                left=grid.c,
                top=grid.f,
                dx=grid.a,
                dy=-grid.e,
                lst_grid=lst,
                ndvi_grid=ndvi,
            )
            for variable, unit, result in (
                ("lst_celsius", "celsius", lst_mean),
                ("ndvi", "unitless", ndvi_mean),
            ):
                session.add(
                    DistrictIndicator(
                        district_id=district.id,
                        boundary_version=boundary_version,
                        variable=variable,
                        statistic="area_weighted_mean_shared_qa",
                        period_start=period,
                        period_end=period,
                        value=result.mean,
                        units=unit,
                        valid_fraction=result.valid_fraction,
                        n=None,
                        processing_run_id=run_id,
                        provenance={
                            "source_url": source_url,
                            "product": PRODUCT,
                            "product_version": PRODUCT_VERSION,
                            "qa_mask": QA_MASK,
                            "resolution_m": 30.0,
                            "crs": f"EPSG:{srid}",
                            "method": PILOT_METHOD,
                            "scene_id": scene_id,
                            "files": manifest["files"],
                            "raster_window_wgs84": list(PILOT_BOUNDS_WGS84),
                            "coverage_note": (
                                "valid_fraction uses the full official district area; "
                                "the Landsat grid is the pilot study window, so districts "
                                "mostly outside that window have low or zero coverage."
                            ),
                        },
                    )
                )
                count += 1
    run = session.get_one(ProcessingRun, run_id)
    run.status = "completed"
    run.finished_at = datetime.now(UTC)
    return count
