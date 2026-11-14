"""Descriptive slopes for short series.

Results are not hypothesis tests. Official publication stays blocked until
district series exist. A short sample is inconclusive. Missing values are
dropped and are not treated as zero.
"""

import math
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import date
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


def _ols_slope(points: Sequence[tuple[float, float]]) -> float | None:
    if len(points) < 2:
        return None
    xs, ys = zip(*points, strict=True)
    x_mean = math.fsum(xs) / len(points)
    y_mean = math.fsum(ys) / len(points)
    var_x = math.fsum((x - x_mean) ** 2 for x in xs)
    if var_x == 0:
        return None
    return math.fsum((x - x_mean) * (y - y_mean) for x, y in zip(xs, ys, strict=True)) / var_x


@dataclass(frozen=True)
class SeasonalObservation:
    acquired_on: date
    value: float | None
    valid_fraction: float


@dataclass(frozen=True)
class SeasonalSlope:
    n_eligible: int
    min_n: int
    slope_per_year: float | None


def seasonal_anomalies(
    observations: Sequence[SeasonalObservation],
    *,
    month: int,
    reference_years: set[int],
    min_valid_fraction: float,
    min_n: int,
) -> tuple[float | None, ...]:
    """Subtract the eligible reference mean, preserving missing observations."""
    eligible = _eligible_seasonal_values(observations, month, min_valid_fraction, min_n)
    reference = [
        value
        for observation, value in zip(observations, eligible, strict=True)
        if value is not None and observation.acquired_on.year in reference_years
    ]
    if len(reference) < min_n:
        return (None,) * len(observations)
    mean = math.fsum(reference) / len(reference)
    return tuple(value - mean if value is not None else None for value in eligible)


def seasonal_descriptive_slope(
    observations: Sequence[SeasonalObservation],
    *,
    month: int,
    min_valid_fraction: float,
    min_n: int,
) -> SeasonalSlope:
    """Summarize one comparable district, boundary version and variable.

    The caller supplies at most one observation per year for the selected month.
    The result describes change over elapsed time without statistical inference.
    """
    eligible = _eligible_seasonal_values(observations, month, min_valid_fraction, min_n)
    points = [
        ((observation.acquired_on - date(2000, 1, 1)).days / 365.2425, value)
        for observation, value in zip(observations, eligible, strict=True)
        if value is not None
    ]
    return SeasonalSlope(
        n_eligible=len(points),
        min_n=min_n,
        slope_per_year=_ols_slope(points) if len(points) >= min_n else None,
    )


def _eligible_seasonal_values(
    observations: Sequence[SeasonalObservation], month: int, min_valid_fraction: float, min_n: int
) -> list[float | None]:
    if not 1 <= month <= 12 or not 0 < min_valid_fraction <= 1 or min_n < 2:
        raise ValueError("Require a valid month, positive coverage threshold and min_n >= 2")

    years: set[int] = set()
    values: list[float | None] = []
    for observation in observations:
        acquired = observation.acquired_on
        if acquired.month != month or acquired.year in years:
            raise ValueError("Require one observation per year in the selected month")
        years.add(acquired.year)
        if not 0 <= observation.valid_fraction <= 1:
            raise ValueError("Observation coverage must be between zero and one")
        value = observation.value
        valid = observation.valid_fraction >= min_valid_fraction
        values.append(value if valid and value is not None and math.isfinite(value) else None)
    return values


def descriptive_slope(
    values: Sequence[float | None],
    *,
    min_n: int = MIN_DESCRIPTIVE_N,
) -> DescriptiveSlope:
    if min_n < 2:
        raise ValueError("min_n must be at least 2")
    points = [
        (float(index), float(value))
        for index, value in enumerate(values)
        if value is not None and math.isfinite(value)
    ]
    n_finite = len(points)
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
        slope_per_step=_ols_slope(points),
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
