"""Descriptive slopes on synthetic series. Not official trends."""

import pytest
from cocha_api.science.indicators import DemoCellMean
from cocha_api.science.trends import demo_series_slopes, descriptive_slope


def test_constant_series_has_zero_slope_without_inference():
    result = descriptive_slope([5.0] * 8)
    assert result.status == "descriptive"
    assert result.slope_per_step == pytest.approx(0.0)
    assert result.publishes_inference is False
    assert result.n_finite == 8


def test_short_series_is_inconclusive():
    result = descriptive_slope([1.0, 2.0, 3.0])
    assert result.status == "inconclusive"
    assert result.n_finite == 3
    assert result.publishes_inference is False


def _demo_mean(index: int, value: float | None) -> DemoCellMean:
    return DemoCellMean(
        district_number=1,
        district_name="Demo 01",
        boundary_version="demo-synthetic-v1",
        scene_id=f"scene-{index}",
        variable="lst_celsius",
        nature="demo_synthetic",
        district_indicator="demo",
        value=value,
        units="celsius",
        n_valid=0 if value is None else 1,
        n_missing=1 if value is None else 0,
        valid_fraction=None if value is None else 1.0,
        statistic="pilot_cell_centroid_mean",
    )


def test_demo_series_slope_is_labeled_and_does_not_infer():
    series = [_demo_mean(index, float(index)) for index in range(8)]
    series[3] = _demo_mean(3, None)
    slopes = demo_series_slopes(series)
    assert len(slopes) == 1
    slope = slopes[0]
    assert slope.nature == "demo_synthetic"
    assert slope.district_trend == "demo"
    assert slope.publishes_inference is False
    assert slope.status == "inconclusive"
    assert slope.n_finite == 7
    assert None in slope.values
    assert "Official trend publication remains blocked" in slope.note


def test_synthetic_slope_and_missing_values():
    result = descriptive_slope([float(2 * index) for index in range(8)])
    assert result.status == "descriptive"
    assert result.slope_per_step == pytest.approx(2.0)
    gapped = descriptive_slope([0.0, None, 2.0], min_n=2)
    assert gapped.status == "descriptive"
    assert gapped.slope_per_step == pytest.approx(1.0)
    assert gapped.n_finite == 2
