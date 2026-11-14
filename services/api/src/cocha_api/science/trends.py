"""Descriptive slopes for short series.

Results are not hypothesis tests. Official publication stays blocked until
district series exist. A short sample is inconclusive. Missing values are
dropped and are not treated as zero.
"""

import math
from collections.abc import Sequence
from dataclasses import dataclass
from typing import Literal

from cocha_api.science.indicators import DemoCellMean

MIN_DESCRIPTIVE_N = 8
TREND_PUBLICATION_REASON = (
    "Official trend publication is unavailable until district time series exist. "
    "Short series stay inconclusive and are not published as trends."
)


@dataclass(frozen=True)
class DescriptiveSlope:
    n_finite: int
    min_n: int
    status: Literal["descriptive", "inconclusive"]
    slope_per_step: float | None
    method: str
    publishes_inference: bool
    note: str


def descriptive_slope(
    values: Sequence[float | None],
    *,
    min_n: int = MIN_DESCRIPTIVE_N,
) -> DescriptiveSlope:
    if min_n < 2:
        raise ValueError("min_n must be at least 2")
    points = [
        (index, float(value))
        for index, value in enumerate(values)
        if value is not None and math.isfinite(value)
    ]
    n_finite = len(points)
    slope: float | None = None
    if n_finite >= 2:
        xs = [point[0] for point in points]
        ys = [point[1] for point in points]
        x_mean = sum(xs) / n_finite
        y_mean = sum(ys) / n_finite
        var_x = sum((x - x_mean) ** 2 for x in xs)
        if var_x > 0:
            covariance = sum((x - x_mean) * (y - y_mean) for x, y in zip(xs, ys, strict=True))
            slope = covariance / var_x
    status: Literal["descriptive", "inconclusive"] = (
        "descriptive" if n_finite >= min_n else "inconclusive"
    )
    if status == "descriptive":
        note = "Descriptive slope only. No p-value or official trend is claimed."
    else:
        note = "Inconclusive: the finite sample is below the minimum for a descriptive slope."
    return DescriptiveSlope(
        n_finite=n_finite,
        min_n=min_n,
        status=status,
        slope_per_step=slope,
        method="descriptive_ols_on_index",
        publishes_inference=False,
        note=note,
    )


@dataclass(frozen=True)
class DemoSeriesSlope:
    district_number: int
    district_name: str
    variable: Literal["lst_celsius", "ndvi"]
    nature: Literal["demo_synthetic"]
    district_trend: Literal["demo"]
    boundary_version: str
    scene_ids: tuple[str, ...]
    values: tuple[float | None, ...]
    n_finite: int
    min_n: int
    status: Literal["descriptive", "inconclusive"]
    slope_per_step: float | None
    method: str
    publishes_inference: Literal[False]
    note: str


def demo_series_slopes(means: Sequence[DemoCellMean]) -> list[DemoSeriesSlope]:
    """Descriptive slopes of demo district series. Official inference stays off."""

    grouped: dict[tuple[int, str], list[DemoCellMean]] = {}
    for item in means:
        grouped.setdefault((item.district_number, item.variable), []).append(item)
    slopes: list[DemoSeriesSlope] = []
    for series in grouped.values():
        first = series[0]
        result = descriptive_slope([point.value for point in series])
        note = (
            f"{result.note} Demo synthetic district series only "
            f"(boundary_version={first.boundary_version}). "
            "Official trend publication remains blocked. "
            "This is not an inference and not a GAMC district."
        )
        slopes.append(
            DemoSeriesSlope(
                district_number=first.district_number,
                district_name=first.district_name,
                variable=first.variable,
                nature="demo_synthetic",
                district_trend="demo",
                boundary_version=first.boundary_version,
                scene_ids=tuple(point.scene_id for point in series),
                values=tuple(point.value for point in series),
                n_finite=result.n_finite,
                min_n=result.min_n,
                status=result.status,
                slope_per_step=result.slope_per_step,
                method=result.method,
                publishes_inference=False,
                note=note,
            )
        )
    return slopes
