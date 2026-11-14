"""Synthetic district rectangles for UI development.

These geometries are not GAMC districts. Official publication stays blocked
until an authorized municipal vector is imported under a different boundary
version. The importer must not overwrite a non-demo boundary.
"""

from __future__ import annotations

import json
from collections.abc import Sequence
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from cocha_api.science.gamc_catalog import PILOT_BOUNDS_WGS84

DEMO_BOUNDARY_VERSION = "demo-synthetic-v1"
DEMO_FIXTURE_RELATIVE = "data/fixtures/demo_districts.geojson"
DEMO_SOURCE = "DEMO fixture — not GAMC official"
_PILOT_PAD_DEGREES = 0.05


class DemoDistrictError(ValueError):
    """The demo fixture or a stored demo geometry failed validation."""


@dataclass(frozen=True)
class DemoPolygon:
    number: int
    name: str
    ring: tuple[tuple[float, float], ...]
    boundary_version: str = DEMO_BOUNDARY_VERSION
    source: str = DEMO_SOURCE

    def as_wkt(self) -> str:
        coords = ", ".join(f"{x:.6f} {y:.6f}" for x, y in self.ring)
        return f"MULTIPOLYGON((({coords})))"


def ring_from_geojson(geometry: object) -> tuple[tuple[float, float], ...]:
    """Exterior ring of a single-part MultiPolygon. Extra parts are rejected."""

    if isinstance(geometry, str):
        geometry = json.loads(geometry)
    if not isinstance(geometry, dict):
        raise DemoDistrictError("Geometry must be a GeoJSON object")
    if geometry.get("type") != "MultiPolygon":
        raise DemoDistrictError("Geometry must be a MultiPolygon")
    coordinates = geometry.get("coordinates")
    if not isinstance(coordinates, list) or len(coordinates) != 1:
        raise DemoDistrictError("Demo geometry must contain one polygon")
    polygon = coordinates[0]
    if not isinstance(polygon, list) or len(polygon) != 1:
        raise DemoDistrictError("Demo geometry must contain one ring and no holes")
    ring_raw = polygon[0]
    if not isinstance(ring_raw, list) or len(ring_raw) < 4:
        raise DemoDistrictError("Ring is too short")
    ring: list[tuple[float, float]] = []
    for point in ring_raw:
        if not isinstance(point, Sequence) or isinstance(point, str) or len(point) < 2:
            raise DemoDistrictError("Coordinate is invalid")
        ring.append((float(point[0]), float(point[1])))
    if ring[0] != ring[-1]:
        raise DemoDistrictError("Ring must be closed")
    return tuple(ring)


def assert_near_pilot(ring: Sequence[tuple[float, float]]) -> None:
    west, south, east, north = PILOT_BOUNDS_WGS84
    xs = [point[0] for point in ring]
    ys = [point[1] for point in ring]
    if (
        min(xs) < west - _PILOT_PAD_DEGREES
        or max(xs) > east + _PILOT_PAD_DEGREES
        or min(ys) < south - _PILOT_PAD_DEGREES
        or max(ys) > north + _PILOT_PAD_DEGREES
    ):
        raise DemoDistrictError("Demo ring is outside the Landsat pilot neighborhood")


def parse_feature_collection(payload: dict[str, Any]) -> list[DemoPolygon]:
    if payload.get("type") != "FeatureCollection":
        raise DemoDistrictError("Expected a GeoJSON FeatureCollection")
    features = payload.get("features")
    if not isinstance(features, list) or len(features) != 15:
        raise DemoDistrictError("Demo fixture must contain exactly 15 features")
    polygons: list[DemoPolygon] = []
    numbers: list[int] = []
    for feature in features:
        if not isinstance(feature, dict):
            raise DemoDistrictError("Feature is invalid")
        properties = feature.get("properties")
        if not isinstance(properties, dict):
            raise DemoDistrictError("Feature properties are missing")
        if properties.get("synthetic") is not True or properties.get("demo") is not True:
            raise DemoDistrictError("Demo features must set synthetic and demo to true")
        if properties.get("source") != DEMO_SOURCE:
            raise DemoDistrictError("Demo feature source label is missing")
        number = properties.get("number")
        if isinstance(number, bool) or not isinstance(number, int) or not 1 <= number <= 15:
            raise DemoDistrictError("District number must be an integer from 1 to 15")
        name = properties.get("name")
        if not isinstance(name, str) or not name.strip():
            raise DemoDistrictError("Demo feature name is missing")
        ring = ring_from_geojson(feature.get("geometry"))
        assert_near_pilot(ring)
        polygons.append(DemoPolygon(number=number, name=name.strip(), ring=ring))
        numbers.append(number)
    if sorted(numbers) != list(range(1, 16)):
        raise DemoDistrictError("Demo numbers must be 1..15 without duplicates")
    return sorted(polygons, key=lambda item: item.number)


def load_demo_fixture(path: Path) -> list[DemoPolygon]:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        raise DemoDistrictError(f"Demo fixture could not be read: {path}") from exc
    if not isinstance(payload, dict):
        raise DemoDistrictError("Demo fixture must be a JSON object")
    return parse_feature_collection(payload)


def geometries_from_query_rows(rows: object) -> list[DemoPolygon]:
    """Parse demo districts returned by a SQL query. Non-lists become empty.

    Invalid rows are skipped. A mocked session that does not return a list
    therefore keeps the public indicators endpoint unavailable.
    """

    if not isinstance(rows, list):
        return []
    polygons: list[DemoPolygon] = []
    for row in rows:
        try:
            version = getattr(row, "boundary_version", None)
            if version != DEMO_BOUNDARY_VERSION:
                continue
            number = getattr(row, "number", None)
            name = getattr(row, "name", None)
            if isinstance(number, bool) or not isinstance(number, int):
                continue
            if not isinstance(name, str) or not name.strip():
                continue
            ring = ring_from_geojson(getattr(row, "geojson", None))
        except (DemoDistrictError, TypeError, ValueError, json.JSONDecodeError):
            continue
        polygons.append(
            DemoPolygon(number=number, name=name.strip(), ring=ring, boundary_version=version)
        )
    return polygons
