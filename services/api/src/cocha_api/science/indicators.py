"""District aggregation guards and pilot-window descriptions.

Point means inside a ring are not area-weighted zonal statistics and are not
served as official district indicators. Official publication requires a verified
district geometry. Demo rectangles stay labeled synthetic. Missing samples stay
missing.
"""

import math
from collections.abc import Iterable, Sequence
from dataclasses import dataclass
from typing import Literal

from cocha_api.science.demo_districts import DemoPolygon

DISTRICT_VECTOR_REASON = (
    "District indicators are unavailable because verified district geometries are missing. "
    "WMS and bounding boxes are not district polygons."
)
SERIES_REASON = (
    "District time series are unavailable until verified district geometries "
    "and accepted multitemporal indicators exist."
)
PILOT_WINDOW_NOTE = (
    "Descriptive means from the Landsat pilot window only. "
    "This is not a district indicator. Missing means stay null."
)
DEMO_INDICATORS_REASON = (
    "Available only as demo synthetic indicators. "
    "The official GAMC district vector is still missing. "
    "Rectangles are not municipal boundaries. "
    "Values are means of pilot-cell centroids inside each rectangle, "
    "not area-weighted zonal statistics and not official district indicators. "
    "LST is the pilot surface-temperature product in Celsius, not air temperature."
)


class DistrictGeometryError(ValueError):
    """Aggregation was asked to treat an unverified geometry as a district."""


@dataclass(frozen=True)
class AreaGeometry:
    provenance: Literal["synthetic", "verified"]
    ring: tuple[tuple[float, float], ...]
    source: str
    version: str | None = None


@dataclass(frozen=True)
class PointSample:
    x: float
    y: float
    value: float | None


@dataclass(frozen=True)
class ZonalMean:
    scope: Literal["synthetic", "verified_district"]
    variable: str
    units: str | None
    mean: float | None
    n_valid: int
    n_missing: int
    n_outside: int
    valid_fraction: float | None
    publishable_as_district: bool
    source: str


@dataclass(frozen=True)
class PixelIntersection:
    area_m2: float
    value: float | None


@dataclass(frozen=True)
class RasterZonalMean:
    mean: float | None
    district_area_m2: float
    intersected_area_m2: float
    valid_area_m2: float
    valid_fraction: float


@dataclass(frozen=True)
class PairedPixelIntersection:
    area_m2: float
    lst_celsius: float | None
    ndvi: float | None


def summarize_paired_intersections(
    intersections: Iterable[PairedPixelIntersection], *, district_area_m2: float
) -> tuple[RasterZonalMean, RasterZonalMean]:
    """Return LST and NDVI means on common valid support for one acquisition."""
    lst_samples = []
    ndvi_samples = []
    for pixel in intersections:
        lst, ndvi = pixel.lst_celsius, pixel.ndvi
        if lst is None or ndvi is None or not math.isfinite(lst) or not math.isfinite(ndvi):
            lst = ndvi = None
        lst_samples.append(PixelIntersection(pixel.area_m2, lst))
        ndvi_samples.append(PixelIntersection(pixel.area_m2, ndvi))
    return (
        summarize_raster_intersections(lst_samples, district_area_m2=district_area_m2),
        summarize_raster_intersections(ndvi_samples, district_area_m2=district_area_m2),
    )


def summarize_raster_intersections(
    intersections: Iterable[PixelIntersection], *, district_area_m2: float
) -> RasterZonalMean:
    """Reduce non-overlapping pixel intersections measured in the same projected CRS."""
    if not math.isfinite(district_area_m2) or district_area_m2 <= 0:
        raise ValueError("District area must be finite and positive")

    intersected_areas: list[float] = []
    valid_areas: list[float] = []
    weighted_values: list[float] = []
    for pixel in intersections:
        if not math.isfinite(pixel.area_m2) or pixel.area_m2 < 0:
            raise ValueError("Pixel intersection area must be finite and nonnegative")
        intersected_areas.append(pixel.area_m2)
        if pixel.area_m2 > 0 and pixel.value is not None and math.isfinite(pixel.value):
            valid_areas.append(pixel.area_m2)
            weighted_values.append(pixel.area_m2 * pixel.value)

    intersected_area = math.fsum(intersected_areas)
    if intersected_area > district_area_m2 and not math.isclose(
        intersected_area, district_area_m2, rel_tol=1e-9
    ):
        raise ValueError("Pixel intersection areas exceed the district area")

    valid_area = math.fsum(valid_areas)
    return RasterZonalMean(
        mean=math.fsum(weighted_values) / valid_area if valid_area else None,
        district_area_m2=district_area_m2,
        intersected_area_m2=min(intersected_area, district_area_m2),
        valid_area_m2=min(valid_area, district_area_m2),
        valid_fraction=min(valid_area / district_area_m2, 1.0),
    )


@dataclass(frozen=True)
class PilotSceneView:
    scene_id: str
    lst_mean: float | None
    ndvi_mean: float | None
    scope: Literal["pilot_window"] = "pilot_window"
    district_indicator: Literal[False] = False


@dataclass(frozen=True)
class PilotWindowView:
    scope: Literal["pilot_window"] = "pilot_window"
    label: Literal["pilot-only"] = "pilot-only"
    note: str = PILOT_WINDOW_NOTE
    scenes: tuple[PilotSceneView, ...] = ()


def _require_ring(geometry: AreaGeometry) -> None:
    if len(geometry.ring) < 4 or geometry.ring[0] != geometry.ring[-1]:
        raise DistrictGeometryError("Geometry ring must be closed")


def point_in_ring(x: float, y: float, ring: Sequence[tuple[float, float]]) -> bool:
    inside = False
    previous = len(ring) - 1
    for index, (xi, yi) in enumerate(ring):
        xj, yj = ring[previous]
        if (yi > y) != (yj > y):
            denominator = yj - yi
            if denominator != 0:
                x_cross = (xj - xi) * (y - yi) / denominator + xi
                if x < x_cross:
                    inside = not inside
        previous = index
    return inside


def _mean_points(
    samples: Sequence[PointSample],
    geometry: AreaGeometry,
    *,
    variable: str,
    units: str | None,
    scope: Literal["synthetic", "verified_district"],
    publishable: bool,
) -> ZonalMean:
    _require_ring(geometry)
    valid: list[float] = []
    missing = 0
    outside = 0
    for sample in samples:
        if not point_in_ring(sample.x, sample.y, geometry.ring):
            outside += 1
            continue
        if sample.value is None or not math.isfinite(sample.value):
            missing += 1
            continue
        valid.append(float(sample.value))
    inside = len(valid) + missing
    mean = sum(valid) / len(valid) if valid else None
    fraction = (len(valid) / inside) if inside else None
    return ZonalMean(
        scope=scope,
        variable=variable,
        units=units,
        mean=mean,
        n_valid=len(valid),
        n_missing=missing,
        n_outside=outside,
        valid_fraction=fraction,
        publishable_as_district=publishable,
        source=geometry.source,
    )


def mean_points_in_geometry(
    samples: Sequence[PointSample],
    geometry: AreaGeometry,
    *,
    variable: str,
    units: str | None,
) -> ZonalMean:
    """Mean of finite samples inside the ring. Missing values are excluded, not replaced."""

    if geometry.provenance != "synthetic":
        raise DistrictGeometryError("This helper only labels synthetic geometries")
    return _mean_points(
        samples,
        geometry,
        variable=variable,
        units=units,
        scope="synthetic",
        publishable=False,
    )


def aggregate_verified_district(
    samples: Sequence[PointSample],
    geometry: AreaGeometry,
    *,
    variable: str,
    units: str | None,
) -> ZonalMean:
    if geometry.provenance != "verified" or not geometry.source.strip() or not geometry.version:
        raise DistrictGeometryError(
            "Verified district aggregation requires provenance, source, and boundary version"
        )
    return _mean_points(
        samples,
        geometry,
        variable=variable,
        units=units,
        scope="verified_district",
        publishable=True,
    )


@dataclass(frozen=True)
class DemoCellMean:
    district_number: int
    district_name: str
    boundary_version: str
    scene_id: str
    variable: Literal["lst_celsius", "ndvi"]
    nature: Literal["demo_synthetic"]
    district_indicator: Literal["demo"]
    value: float | None
    units: Literal["celsius", "dimensionless"]
    n_valid: int
    n_missing: int
    valid_fraction: float | None
    statistic: Literal["pilot_cell_centroid_mean"]


def _centroid_samples(cells: Sequence[object], attribute: str) -> list[PointSample]:
    samples: list[PointSample] = []
    for cell in cells:
        bounds = getattr(cell, "bounds", None)
        if not isinstance(bounds, (tuple, list)) or len(bounds) != 4:
            continue
        west, south, east, north = (float(item) for item in bounds)
        raw = getattr(cell, attribute, None)
        value = None if raw is None else float(raw)
        samples.append(PointSample(x=(west + east) / 2.0, y=(south + north) / 2.0, value=value))
    return samples


def demo_indicator_means(
    districts: Sequence[DemoPolygon], scenes: Sequence[object]
) -> list[DemoCellMean]:
    """Centroid means of pilot cells inside demo rectangles.

    Missing cell values stay null. This is not an official zonal statistic.
    """

    variables = (
        ("lst", "lst_celsius", "celsius"),
        ("ndvi", "ndvi", "dimensionless"),
    )
    means: list[DemoCellMean] = []
    for district in districts:
        geometry = AreaGeometry(
            provenance="synthetic",
            ring=district.ring,
            source=district.source,
            version=district.boundary_version,
        )
        for scene in scenes:
            scene_id = getattr(scene, "id", None)
            if scene_id is None:
                scene_id = getattr(scene, "scene_id", None)
            if scene_id is None:
                continue
            cells = getattr(scene, "cells", ()) or ()
            for attribute, variable, units in variables:
                result = mean_points_in_geometry(
                    _centroid_samples(cells, attribute),
                    geometry,
                    variable=variable,
                    units=units,
                )
                public_variable: Literal["lst_celsius", "ndvi"] = (
                    "lst_celsius" if variable == "lst_celsius" else "ndvi"
                )
                public_units: Literal["celsius", "dimensionless"] = (
                    "celsius" if units == "celsius" else "dimensionless"
                )
                means.append(
                    DemoCellMean(
                        district_number=district.number,
                        district_name=district.name,
                        boundary_version=district.boundary_version,
                        scene_id=str(scene_id),
                        variable=public_variable,
                        nature="demo_synthetic",
                        district_indicator="demo",
                        value=result.mean,
                        units=public_units,
                        n_valid=result.n_valid,
                        n_missing=result.n_missing,
                        valid_fraction=result.valid_fraction,
                        statistic="pilot_cell_centroid_mean",
                    )
                )
    return means


def pilot_window_from_scenes(scenes: Sequence[object]) -> PilotWindowView:
    views = []
    for scene in scenes:
        lst = getattr(scene, "lst_mean", None)
        ndvi = getattr(scene, "ndvi_mean", None)
        views.append(
            PilotSceneView(
                scene_id=str(scene.id),
                lst_mean=None if lst is None else float(lst),
                ndvi_mean=None if ndvi is None else float(ndvi),
            )
        )
    return PilotWindowView(scenes=tuple(views))
