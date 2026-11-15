"""Statistical edge cases; synthetic values only in tests."""

import importlib.util
from pathlib import Path

import numpy as np
import pytest

pytest.importorskip("scipy")
pytest.importorskip("matplotlib")
pytest.importorskip("rasterio")
spec = importlib.util.spec_from_file_location(
    "pilot_analysis", Path(__file__).parents[2] / "scripts/analyze_pilot_trends.py"
)
assert spec is not None and spec.loader is not None
analysis = importlib.util.module_from_spec(spec)
spec.loader.exec_module(analysis)


def test_constant_series_does_not_claim_change():
    result = analysis.trend_statistics(list(range(2014, 2026)), [2.0] * 12)
    assert result["slope_per_year"] == 0
    assert result["p_value"] == 1


def test_missing_and_irregular_series_refused():
    with pytest.raises(ValueError):
        analysis.trend_statistics([2022, 2023, 2024], [1, 2, 3])
    with pytest.raises(ValueError):
        analysis.trend_statistics(list(range(2014, 2026)), [np.nan] * 12)
    with pytest.raises(ValueError):
        analysis.trend_statistics(list(range(2000, 2024, 2)), list(range(12)))


def test_slope_uses_year_units_and_holm_controls_two_tests():
    result = analysis.trend_statistics(list(range(2014, 2026)), list(range(0, 24, 2)))
    assert result["slope_per_year"] == pytest.approx(2)
    assert result["ci95"][0] <= 2 <= result["ci95"][1]
    assert analysis.holm_adjust([0.04, 0.01]) == pytest.approx([0.04, 0.02])
