"""Synthetic geometries only. They are not Cochabamba districts."""

import pytest
from cocha_api.science.indicators import (
    AreaGeometry,
    DistrictGeometryError,
    PointSample,
    aggregate_verified_district,
    demo_indicator_means,
    mean_points_in_geometry,
    pilot_window_from_scenes,
)

SQUARE = AreaGeometry(
    provenance="synthetic",
    ring=((0.0, 0.0), (2.0, 0.0), (2.0, 2.0), (0.0, 2.0), (0.0, 0.0)),
    source="synthetic-fixture",
)


def test_missing_samples_are_not_converted_to_zero():
    result = mean_points_in_geometry(
        [
            PointSample(1.0, 1.0, 10.0),
            PointSample(1.0, 1.5, None),
            PointSample(5.0, 5.0, 0.0),
            PointSample(0.5, 0.5, 30.0),
        ],
        SQUARE,
        variable="synthetic",
        units=None,
    )
    assert result.scope == "synthetic"
    assert result.publishable_as_district is False
    assert result.mean == pytest.approx(20.0)
    assert result.n_missing == 1
    assert result.n_outside == 1
    assert result.mean != 0


def test_all_missing_inside_stays_none():
    result = mean_points_in_geometry(
        [PointSample(1.0, 1.0, None), PointSample(0.2, 0.2, None)],
        SQUARE,
        variable="synthetic",
        units=None,
    )
    assert result.mean is None
    assert result.n_valid == 0
    assert result.valid_fraction == 0


def test_verified_aggregation_rejects_synthetic_geometry():
    with pytest.raises(DistrictGeometryError):
        aggregate_verified_district(
            [PointSample(1.0, 1.0, 1.0)],
            SQUARE,
            variable="synthetic",
            units=None,
        )


def test_verified_label_still_names_its_source():
    geometry = AreaGeometry(
        provenance="verified",
        ring=SQUARE.ring,
        source="unit-test label only; not a GAMC district",
        version="test-not-official",
    )
    result = aggregate_verified_district(
        [PointSample(1.0, 1.0, 4.0)],
        geometry,
        variable="synthetic",
        units=None,
    )
    assert result.scope == "verified_district"
    assert result.publishable_as_district is True
    assert "not a GAMC" in result.source
    assert result.mean == pytest.approx(4.0)


def test_demo_centroid_mean_keeps_missing_values_null():
    from pathlib import Path

    from cocha_api.science.demo_districts import load_demo_fixture

    district = load_demo_fixture(
        Path(__file__).resolve().parents[2] / "data" / "fixtures" / "demo_districts.geojson"
    )[0]
    west, south = district.ring[0]
    east, north = district.ring[2]
    scene = type(
        "Scene",
        (),
        {
            "id": "synthetic-scene",
            "cells": [
                type(
                    "Cell",
                    (),
                    {"bounds": (west, south, east, north), "lst": 21.5, "ndvi": None},
                )(),
                type("Cell", (), {"bounds": (0.0, 0.0, 1.0, 1.0), "lst": 0.0, "ndvi": 0.0})(),
            ],
        },
    )()
    means = demo_indicator_means([district], [scene])
    by_variable = {item.variable: item for item in means}
    assert by_variable["lst_celsius"].nature == "demo_synthetic"
    assert by_variable["lst_celsius"].district_indicator == "demo"
    assert by_variable["lst_celsius"].value == pytest.approx(21.5)
    assert by_variable["lst_celsius"].n_valid == 1
    assert by_variable["lst_celsius"].n_missing == 0
    assert by_variable["ndvi"].value is None
    assert by_variable["ndvi"].n_missing == 1
    assert by_variable["ndvi"].value != 0


def test_pilot_window_preserves_missing_means():
    scene = type("Scene", (), {"id": "fixture-scene", "lst_mean": None, "ndvi_mean": 0.2})()
    view = pilot_window_from_scenes([scene])
    assert view.label == "pilot-only"
    assert view.scenes[0].district_indicator is False
    assert view.scenes[0].lst_mean is None
    assert view.scenes[0].ndvi_mean == pytest.approx(0.2)
