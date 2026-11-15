"""Validation helpers for an authorized GAMC district vector.

Does not invent geometries. Third-party or demo layers are rejected unless the
operator explicitly labels a non-official review path. Full topology checks
(ST_IsValid, overlaps) belong in PostGIS after import.
"""

from __future__ import annotations

import json
import math
from collections.abc import Sequence
from dataclasses import dataclass
from pathlib import Path
from typing import Any

# Approximate municipal extent from documented GAMC WMS BBOX for Limite Distritos.
MUNICIPAL_BOUNDS_WGS84: tuple[float, float, float, float] = (
    -66.280703,
    -17.53119,
    -66.06952,
    -17.257306,
)
_BOUNDS_PAD_DEGREES = 0.02
OFFICIAL_BOUNDARY_PREFIX = "gamc-official-"
DEMO_BOUNDARY_PREFIX = "demo-synthetic"


class OfficialDistrictError(ValueError):
    """Authorized district vector failed structural validation."""


@dataclass(frozen=True)
class OfficialPolygon:
    number: int
    name: str
    rings: tuple[tuple[tuple[float, float], ...], ...]
    boundary_version: str
    source_url: str
    official_id: str | None = None
    holes: tuple[tuple[tuple[tuple[float, float], ...], ...], ...] = ()

    @property
    def ring(self) -> tuple[tuple[float, float], ...]:
        return self.rings[0]

    def as_wkt(self) -> str:
        parts = []
        for index, ring in enumerate(self.rings):
            coords = ", ".join(f"{x:.8f} {y:.8f}" for x, y in ring)
            interiors = self.holes[index] if self.holes else ()
            encoded = [f"({coords})"]
            for interior in interiors:
                encoded.append("(" + ", ".join(f"{x:.8f} {y:.8f}" for x, y in interior) + ")")
            parts.append("(" + ", ".join(encoded) + ")")
        return f"MULTIPOLYGON({', '.join(parts)})"

    def bbox(self) -> tuple[float, float, float, float]:
        xs = [point[0] for ring in self.rings for point in ring]
        ys = [point[1] for ring in self.rings for point in ring]
        return min(xs), min(ys), max(xs), max(ys)

    def signed_area(self) -> float:
        def area(ring: tuple[tuple[float, float], ...]) -> float:
            return (
                abs(
                    math.fsum(
                        x1 * y2 - x2 * y1
                        for (x1, y1), (x2, y2) in zip(ring[:-1], ring[1:], strict=True)
                    )
                )
                / 2
            )

        return math.fsum(
            area(ring) - math.fsum(area(hole) for hole in (self.holes[index] if self.holes else ()))
            for index, ring in enumerate(self.rings)
        )


def _parse_ring(ring_raw: object) -> tuple[tuple[float, float], ...]:
    if not isinstance(ring_raw, list) or len(ring_raw) < 4:
        raise OfficialDistrictError("Exterior ring is too short")
    ring: list[tuple[float, float]] = []
    for point in ring_raw:
        if not isinstance(point, Sequence) or isinstance(point, str) or len(point) < 2:
            raise OfficialDistrictError("Coordinate is invalid")
        try:
            coordinate = (float(point[0]), float(point[1]))
        except (TypeError, ValueError, OverflowError) as error:
            raise OfficialDistrictError("Coordinate must be numeric") from error
        if not all(math.isfinite(value) for value in coordinate):
            raise OfficialDistrictError("Coordinate must be finite")
        ring.append(coordinate)
    if ring[0] != ring[-1]:
        raise OfficialDistrictError("Exterior ring must be closed")
    return tuple(ring)


def rings_from_geojson(geometry: object) -> tuple[tuple[tuple[float, float], ...], ...]:
    if isinstance(geometry, str):
        geometry = json.loads(geometry)
    if not isinstance(geometry, dict):
        raise OfficialDistrictError("Geometry must be a GeoJSON object")
    geometry_type = geometry.get("type")
    coordinates = geometry.get("coordinates")
    rings: list[tuple[tuple[float, float], ...]] = []
    if geometry_type == "Polygon":
        if not isinstance(coordinates, list) or not coordinates:
            raise OfficialDistrictError("Polygon coordinates are missing")
        rings.append(_parse_ring(coordinates[0]))
    elif geometry_type == "MultiPolygon":
        if not isinstance(coordinates, list) or not coordinates:
            raise OfficialDistrictError("MultiPolygon coordinates are missing")
        for polygon in coordinates:
            if not isinstance(polygon, list) or not polygon:
                raise OfficialDistrictError("MultiPolygon part is empty")
            rings.append(_parse_ring(polygon[0]))
    else:
        raise OfficialDistrictError("Geometry must be Polygon or MultiPolygon")
    return tuple(rings)


def ring_from_geojson(geometry: object) -> tuple[tuple[float, float], ...]:
    return rings_from_geojson(geometry)[0]


def assert_within_municipal_extent(ring: Sequence[tuple[float, float]]) -> None:
    west, south, east, north = MUNICIPAL_BOUNDS_WGS84
    xs = [point[0] for point in ring]
    ys = [point[1] for point in ring]
    if (
        min(xs) < west - _BOUNDS_PAD_DEGREES
        or max(xs) > east + _BOUNDS_PAD_DEGREES
        or min(ys) < south - _BOUNDS_PAD_DEGREES
        or max(ys) > north + _BOUNDS_PAD_DEGREES
    ):
        raise OfficialDistrictError("Geometry falls outside the documented municipal WMS extent")


def _require_int_district(value: object) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or not 1 <= value <= 15:
        raise OfficialDistrictError("District number must be an integer from 1 to 15")
    return value


def parse_official_feature_collection(
    payload: dict[str, Any],
    *,
    boundary_version: str,
    source_url: str,
    allow_demo_labels: bool = False,
) -> list[OfficialPolygon]:
    if not boundary_version.startswith(OFFICIAL_BOUNDARY_PREFIX):
        raise OfficialDistrictError(f"boundary_version must start with {OFFICIAL_BOUNDARY_PREFIX}")
    if payload.get("type") != "FeatureCollection":
        raise OfficialDistrictError("Expected a GeoJSON FeatureCollection")
    crs = payload.get("crs")
    if crs is not None:
        # GeoJSON default is WGS84; reject explicit non-4326 declarations.
        name = None
        if isinstance(crs, dict):
            properties = crs.get("properties")
            if isinstance(properties, dict):
                name = properties.get("name")
        if isinstance(name, str) and "4326" not in name and "CRS84" not in name.upper():
            raise OfficialDistrictError("CRS must be WGS84 / EPSG:4326")
    features = payload.get("features")
    if not isinstance(features, list) or len(features) != 15:
        raise OfficialDistrictError("Official vector must contain exactly 15 features")

    polygons: list[OfficialPolygon] = []
    numbers: list[int] = []
    for feature in features:
        if not isinstance(feature, dict):
            raise OfficialDistrictError("Feature is invalid")
        properties = feature.get("properties")
        if not isinstance(properties, dict):
            raise OfficialDistrictError("Feature properties are missing")
        if properties.get("synthetic") is True or properties.get("demo") is True:
            if not allow_demo_labels:
                raise OfficialDistrictError(
                    "Feature is labeled synthetic/demo; refuse official import"
                )
        number = _require_int_district(properties.get("number"))
        name = properties.get("name")
        if not isinstance(name, str) or not name.strip():
            raise OfficialDistrictError("Feature name is missing")
        official_id = properties.get("official_id") or properties.get("id")
        if official_id is not None and not isinstance(official_id, str | int):
            raise OfficialDistrictError("official_id must be a string or integer when present")
        geometry = feature.get("geometry")
        rings = rings_from_geojson(geometry)
        if isinstance(geometry, str):
            geometry = json.loads(geometry)
        parts = (
            [geometry["coordinates"]] if geometry["type"] == "Polygon" else geometry["coordinates"]
        )
        holes = tuple(tuple(_parse_ring(ring) for ring in part[1:]) for part in parts)
        for interiors in holes:
            for interior in interiors:
                assert_within_municipal_extent(interior)
        for ring in rings:
            assert_within_municipal_extent(ring)
        polygon = OfficialPolygon(
            number=number,
            name=name.strip(),
            rings=rings,
            holes=holes,
            boundary_version=boundary_version,
            source_url=source_url,
            official_id=str(official_id) if official_id is not None else None,
        )
        if abs(polygon.signed_area()) < 1e-12:
            raise OfficialDistrictError(f"District {number} has near-zero area")
        polygons.append(polygon)
        numbers.append(number)

    if sorted(numbers) != list(range(1, 16)):
        raise OfficialDistrictError("District numbers must be 1..15 without duplicates")

    # Lightweight pairwise bbox overlap report (not a topology proof).
    for left_index, left in enumerate(polygons):
        for right in polygons[left_index + 1 :]:
            lw, ls, le, ln = left.bbox()
            rw, rs, re, rn = right.bbox()
            if lw < re and le > rw and ls < rn and ln > rs:
                # Overlapping BBOXes are expected for adjacent districts; only
                # record in caller reports. No automatic rejection here.
                pass
    return sorted(polygons, key=lambda item: item.number)


def load_official_geojson(
    path: Path,
    *,
    boundary_version: str,
    source_url: str,
) -> list[OfficialPolygon]:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        raise OfficialDistrictError(f"Official vector could not be read: {path}") from exc
    if not isinstance(payload, dict):
        raise OfficialDistrictError("Official vector must be a JSON object")
    return parse_official_feature_collection(
        payload,
        boundary_version=boundary_version,
        source_url=source_url,
    )


def validation_report(polygons: list[OfficialPolygon]) -> dict[str, Any]:
    extents = [polygon.bbox() for polygon in polygons]
    return {
        "feature_count": len(polygons),
        "numbers": [polygon.number for polygon in polygons],
        "boundary_version": polygons[0].boundary_version if polygons else None,
        "source_url": polygons[0].source_url if polygons else None,
        "srid": 4326,
        "bbox_union_wgs84": [
            min(extent[0] for extent in extents),
            min(extent[1] for extent in extents),
            max(extent[2] for extent in extents),
            max(extent[3] for extent in extents),
        ]
        if extents
        else None,
        "topology_note": (
            "Structural GeoJSON checks only. Run PostGIS ST_IsValid / overlap "
            "review after import; this helper does not prove official topology."
        ),
        "demo_boundary_prefix_rejected": DEMO_BOUNDARY_PREFIX,
    }
