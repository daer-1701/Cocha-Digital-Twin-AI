"""Landsat 8/9 C2 L2: USGS scales and conservative shared valid-pixel mask."""

import numpy as np
from numpy.typing import NDArray


def indicators(
    red: NDArray,
    nir: NDArray,
    thermal: NDArray,
    qa: NDArray,
    saturation: NDArray,
) -> tuple[NDArray, NDArray]:
    if len({band.shape for band in (red, nir, thermal, qa, saturation)}) != 1:
        raise ValueError("Bands must share the same grid")
    # QA_PIXEL bits 0..5: fill, dilated cloud, cirrus, cloud, shadow, snow.
    valid = ((qa & 63) == 0) & (saturation == 0)
    valid &= (red > 0) & (nir > 0) & (thermal > 0)
    r = red.astype(float) * 0.0000275 - 0.2
    n = nir.astype(float) * 0.0000275 - 0.2
    valid &= (r >= 0) & (r <= 1) & (n >= 0) & (n <= 1) & ((n + r) > 1e-8)
    ndvi = np.full(red.shape, np.nan)
    np.divide(n - r, n + r, out=ndvi, where=valid)
    lst = np.where(valid, thermal.astype(float) * 0.00341802 + 149.0 - 273.15, np.nan)
    return lst, ndvi


def finite_mean(values: NDArray) -> float | None:
    valid = values[np.isfinite(values)]
    return round(float(valid.mean()), 4) if valid.size else None
