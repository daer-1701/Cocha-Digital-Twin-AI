"""District aggregation guards and pilot-window descriptions.

Point means inside a ring are not area-weighted zonal statistics and are not
served as district indicators. Official publication requires a verified
district geometry. Missing samples stay missing.
"""

import math
from collections.abc import Sequence
from dataclasses import dataclass
from typing import Literal

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
