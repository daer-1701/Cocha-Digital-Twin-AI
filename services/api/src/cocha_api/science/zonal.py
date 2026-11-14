"""Offline district zonal statistics using the project's PostGIS geometry engine."""

import math
from collections.abc import Sequence

from sqlalchemy import text
from sqlalchemy.orm import Session

from cocha_api.science.indicators import (
    DistrictGeometryError,
    PairedPixelIntersection,
    RasterZonalMean,
    summarize_paired_intersections,
)

# Inputs and areas use the same projected, metre-based CRS. Assigning SRIDs and
# reprojection happen before this step, when preparing the scene and boundary.
_PIXEL_AREAS = text("""
    WITH boundary AS (
        SELECT ST_GeomFromText(:district_wkt) AS geom
    ), district AS MATERIALIZED (
        SELECT geom, ST_Area(geom) AS area
        FROM boundary
        WHERE GeometryType(geom) IN ('POLYGON', 'MULTIPOLYGON')
          AND ST_IsValid(geom) AND NOT ST_IsEmpty(geom)
    ), intersections AS (
        SELECT row_idx, col_idx, ST_Area(ST_Intersection(geom, pixel)) AS area
        FROM district
        CROSS JOIN LATERAL generate_series(
            GREATEST(0, floor((:top - ST_YMax(geom)) / :dy)::bigint),
            LEAST(:height - 1, ceil((:top - ST_YMin(geom)) / :dy)::bigint - 1)
        ) AS rows(row_idx)
        CROSS JOIN LATERAL generate_series(
            GREATEST(0, floor((ST_XMin(geom) - :left) / :dx)::bigint),
            LEAST(:width - 1, ceil((ST_XMax(geom) - :left) / :dx)::bigint - 1)
        ) AS cols(col_idx)
        CROSS JOIN LATERAL ST_MakeEnvelope(
            :left + col_idx * :dx, :top - (row_idx + 1) * :dy,
            :left + (col_idx + 1) * :dx, :top - row_idx * :dy
        ) AS pixels(pixel)
        WHERE ST_Intersects(geom, pixel)
    )
    SELECT district.area AS district_area, row_idx, col_idx, intersections.area AS pixel_area
    FROM district
    LEFT JOIN intersections ON intersections.area > 0
""")


def district_raster_means(
    session: Session,
    *,
    district_wkt: str,
    left: float,
    top: float,
    dx: float,
    dy: float,
    lst_grid: Sequence[Sequence[float | None]],
    ndvi_grid: Sequence[Sequence[float | None]],
) -> tuple[RasterZonalMean, RasterZonalMean]:
    """Summarize a north-up QA-masked raster pair against one projected polygon."""
    height = len(lst_grid)
    width = len(lst_grid[0]) if height else 0
    if (
        not width
        or len(ndvi_grid) != height
        or any(len(row) != width for grid in (lst_grid, ndvi_grid) for row in grid)
    ):
        raise ValueError("Require two aligned, nonempty rectangular grids")
    if not all(map(math.isfinite, (left, top, dx, dy))) or min(dx, dy) <= 0:
        raise ValueError("Require finite grid origin and positive pixel dimensions")

    rows = session.execute(
        _PIXEL_AREAS,
        {
            "district_wkt": district_wkt,
            "left": left,
            "top": top,
            "dx": dx,
            "dy": dy,
            "height": height,
            "width": width,
        },
    ).all()
    if not rows:
        raise DistrictGeometryError("Require a valid nonempty district polygon")
    return summarize_paired_intersections(
        (
            PairedPixelIntersection(row.pixel_area, lst_grid[r][c], ndvi_grid[r][c])
            for row in rows
            if (r := row.row_idx) is not None and (c := row.col_idx) is not None
        ),
        district_area_m2=rows[0].district_area,
    )
