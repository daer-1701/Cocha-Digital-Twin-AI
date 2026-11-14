"""Viability refuses LST–PM10 calibration and reports no metrics."""

import pytest
from cocha_api.science.viability import (
    CalibrationRefusal,
    calibrate_lst_with_pm10,
    fusion_viability,
)


def test_lst_pm10_calibration_is_refused():
    with pytest.raises(CalibrationRefusal, match="PM10"):
        calibrate_lst_with_pm10([1.0], [2.0])


def test_verdict_is_not_viable_and_has_no_metrics():
    verdict = fusion_viability()
    assert verdict.viable is False
    assert verdict.metrics is None
    text = " ".join(verdict.blockers).lower()
    assert "pm10" in text
    assert "air temperature" in text
    assert "15" in text
    assert "trained model" in text.lower() or "no trained" in text
