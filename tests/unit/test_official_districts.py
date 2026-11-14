"""Official district validator. Does not treat demo rectangles as GAMC."""

from cocha_api.science.official_districts import (
    OfficialDistrictError,
    parse_official_feature_collection,
    validation_report,
)


def _ring(west: float, south: float, east: float, north: float) -> list[list[float]]:
    return [
        [west, south],
        [east, south],
        [east, north],
        [west, north],
        [west, south],
    ]


def _feature(number: int, *, synthetic: bool = False) -> dict:
    # Place rectangles inside the documented municipal WMS extent.
    west = -66.20 + (number - 1) * 0.005
    south = -17.40
    props = {"number": number, "name": f"Distrito {number}", "official_id": f"D{number}"}
    if synthetic:
        props["synthetic"] = True
        props["demo"] = True
    return {
        "type": "Feature",
        "properties": props,
        "geometry": {
            "type": "MultiPolygon",
            "coordinates": [[_ring(west, south, west + 0.004, south + 0.004)]],
        },
    }


def test_rejects_demo_labeled_features_as_official():
    payload = {
        "type": "FeatureCollection",
        "features": [_feature(n, synthetic=True) for n in range(1, 16)],
    }
    try:
        parse_official_feature_collection(
            payload,
            boundary_version="gamc-official-20261114",
            source_url="https://example.invalid/authorized",
        )
        raise AssertionError("expected OfficialDistrictError")
    except OfficialDistrictError as error:
        assert "synthetic/demo" in str(error)


def test_accepts_structurally_valid_fifteen_districts():
    payload = {
        "type": "FeatureCollection",
        "features": [_feature(n) for n in range(1, 16)],
    }
    polygons = parse_official_feature_collection(
        payload,
        boundary_version="gamc-official-20261114",
        source_url="https://example.invalid/authorized",
    )
    assert [item.number for item in polygons] == list(range(1, 16))
    report = validation_report(polygons)
    assert report["feature_count"] == 15
    assert report["srid"] == 4326


def test_rejects_non_official_boundary_prefix():
    payload = {"type": "FeatureCollection", "features": [_feature(1)]}
    try:
        parse_official_feature_collection(
            payload,
            boundary_version="demo-synthetic-v1",
            source_url="https://example.invalid/authorized",
        )
        raise AssertionError("expected OfficialDistrictError")
    except OfficialDistrictError as error:
        assert "gamc-official-" in str(error)
