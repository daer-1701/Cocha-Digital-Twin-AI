"""Synthetic arrays used only to verify the decoding and masking math."""

import numpy as np
import pytest
from cocha_api.science.landsat import finite_mean, indicators


def test_scales_offsets_and_temperature():
    lst, ndvi = indicators(*(np.array([[v]]) for v in [10000, 20000, 44000, 0, 0]))
    assert lst[0, 0] == pytest.approx(44000 * 0.00341802 + 149 - 273.15)
    assert ndvi[0, 0] == pytest.approx((0.35 - 0.075) / (0.35 + 0.075))


@pytest.mark.parametrize("bit", range(6))
def test_each_bad_qa_flag_masks_values(bit):
    lst, ndvi = indicators(*(np.array([[v]]) for v in [10000, 20000, 44000, 1 << bit, 0]))
    assert finite_mean(lst) is None
    assert finite_mean(ndvi) is None


def test_saturation_and_fill_are_not_zero_temperature():
    for thermal, saturation in [(0, 0), (44000, 8)]:
        lst, _ = indicators(*(np.array([[v]]) for v in [10000, 20000, thermal, 0, saturation]))
        assert finite_mean(lst) is None


def test_misaligned_bands_rejected():
    with pytest.raises(ValueError, match="same grid"):
        indicators(np.zeros((2, 2)), *(np.zeros((1, 1)) for _ in range(4)))
