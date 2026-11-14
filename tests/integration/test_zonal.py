"""Synthetic projected polygons and raster cells for PostGIS intersection checks."""

import os
from pathlib import Path

import numpy as np
import pytest
import rasterio
from cocha_api.db.models import District, DistrictIndicator, ProcessingRun
from cocha_api.db.session import get_engine
from cocha_api.science.district_batch import persist_district_batch
from cocha_api.science.landsat import BANDS
from cocha_api.science.zonal import district_raster_means
from geoalchemy2.elements import WKTElement
from rasterio.transform import from_origin
from sqlalchemy import select
from sqlalchemy.orm import Session

pytestmark = [
    pytest.mark.integration,
    pytest.mark.skipif(os.getenv("RUN_DB_TESTS") != "1", reason="Requires PostGIS"),
]


def test_partial_pixels_hole_nodata_and_outside_raster():
    engine = get_engine()
    if not (engine.url.database or "").endswith("_test"):
        pytest.fail("Zonal checks require a dedicated _test database")

    grid = {
        "left": 0.0,
        "top": 1.0,
        "dx": 1.0,
        "dy": 1.0,
        "lst_grid": [[10.0, None]],
        "ndvi_grid": [[0.25, 0.75]],
    }
    with Session(engine) as session:
        lst, ndvi = district_raster_means(
            session,
            district_wkt=(
                "POLYGON((0.5 0,2.5 0,2.5 1,0.5 1,0.5 0),"
                "(0.6 0.25,0.8 0.25,0.8 0.75,0.6 0.75,0.6 0.25))"
            ),
            **grid,
        )
        outside, _ = district_raster_means(
            session,
            district_wkt="POLYGON((4 0,5 0,5 1,4 1,4 0))",
            **grid,
        )

    assert lst.mean == 10
    assert ndvi.mean == 0.25
    assert lst.district_area_m2 == pytest.approx(1.9)
    assert lst.intersected_area_m2 == pytest.approx(1.4)
    assert lst.valid_area_m2 == pytest.approx(0.4)
    assert lst.valid_fraction == ndvi.valid_fraction == pytest.approx(0.4 / 1.9)
    assert outside.mean is None
    assert outside.valid_fraction == 0


def test_persist_local_landsat_batch_is_idempotent(tmp_path: Path):
    engine = get_engine()
    if not (engine.url.database or "").endswith("_test"):
        pytest.fail("Zonal checks require a dedicated _test database")

    for band, dn in zip(BANDS, (10000, 20000, 44000, 0, 0), strict=True):
        with rasterio.open(
            tmp_path / f"{band}.tif",
            "w",
            driver="GTiff",
            width=1,
            height=1,
            count=1,
            dtype="uint16",
            crs="EPSG:32719",
            transform=from_origin(790000, 8070000, 30, 30),
        ) as raster:
            raster.write(np.array([[dn]], dtype="uint16"), 1)
    item = {
        "id": "synthetic-scene",
        "properties": {"datetime": "2024-07-09T14:00:00Z"},
        "assets": {band: {"href": f"https://example.invalid/{band}.tif"} for band in BANDS},
    }
    version = "test-synthetic-district-batch"
    with Session(engine) as session:
        session.add_all(
            District(
                number=number,
                name=f"Synthetic {number}",
                source_url="https://example.invalid/synthetic",
                boundary_version=version,
                geometry=WKTElement(
                    "MULTIPOLYGON(((-66.2 -17.5,-66.1 -17.5,-66.1 -17.4,-66.2 -17.4,-66.2 -17.5)))",
                    srid=4326,
                ),
            )
            for number in range(1, 16)
        )
        inputs = [(item, tmp_path)]
        assert (
            persist_district_batch(session, inputs, boundary_version=version, commit="test") == 30
        )
        assert persist_district_batch(session, inputs, boundary_version=version, commit="test") == 0
        rows = session.scalars(
            select(DistrictIndicator).where(DistrictIndicator.boundary_version == version)
        ).all()
        assert len(rows) == 30
        assert all(row.period_start.isoformat() == "2024-07-09" for row in rows)
        assert session.get_one(ProcessingRun, rows[0].processing_run_id).status == "completed"
