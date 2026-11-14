"""Descriptive slopes on synthetic series. Not official trends."""

import pytest
from cocha_api.science.trends import descriptive_slope


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


def test_synthetic_slope_and_missing_values():
    result = descriptive_slope([float(2 * index) for index in range(8)])
    assert result.status == "descriptive"
    assert result.slope_per_step == pytest.approx(2.0)
    gapped = descriptive_slope([0.0, None, 2.0], min_n=2)
    assert gapped.status == "descriptive"
    assert gapped.slope_per_step == pytest.approx(1.0)
    assert gapped.n_finite == 2
