"""Synthetic geometries only. They are not Cochabamba districts."""

import pytest
from cocha_api.science.indicators import (
    AreaGeometry,
    DistrictGeometryError,
    PointSample,
    aggregate_verified_district,
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


def test_pilot_window_preserves_missing_means():
    scene = type("Scene", (), {"id": "fixture-scene", "lst_mean": None, "ndvi_mean": 0.2})()
    view = pilot_window_from_scenes([scene])
    assert view.label == "pilot-only"
    assert view.scenes[0].district_indicator is False
    assert view.scenes[0].lst_mean is None
    assert view.scenes[0].ndvi_mean == pytest.approx(0.2)
