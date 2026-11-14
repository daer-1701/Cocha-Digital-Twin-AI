"""Fusion viability. MONICA PM10 cannot calibrate Landsat LST."""

from dataclasses import dataclass

FUSION_BLOCKERS = (
    "MONICA CSV observations are PM10, not air temperature.",
    "LST cannot be calibrated with PM10.",
    "Two stations are not sufficient for spatial validation across 15 districts.",
    "Verified GAMC district geometries are not available.",
    "PM10 analysis_enabled stays false until Mateo accepts series QA (MF06).",
    "No compatible target variable is available and no trained model artifact exists.",
)
FUSION_NOTE = "Fusion and ML are blocked. No calibration and no metrics are reported. " + " ".join(
    FUSION_BLOCKERS
)
SCENARIO_BLOCKERS = (
    "No validated model is available to drive a scenario.",
    "A change in NDVI is not an evaluated urban intervention.",
    "No scenario results are computed.",
)
SCENARIO_REASON = (
    "Scenarios are unavailable because no validated model exists. "
    "Hypothetical NDVI changes are not evaluated interventions."
)


class CalibrationRefusal(Exception):
    """LST and PM10 were paired for a calibration this project refuses."""


@dataclass(frozen=True)
class ViabilityVerdict:
    viable: bool
    metrics: None
    blockers: tuple[str, ...]
    note: str


def fusion_viability() -> ViabilityVerdict:
    return ViabilityVerdict(viable=False, metrics=None, blockers=FUSION_BLOCKERS, note=FUSION_NOTE)


def calibrate_lst_with_pm10(*_args: object, **_kwargs: object) -> None:
    raise CalibrationRefusal(
        "Refusing LST to PM10 calibration: MONICA PM10 is not air temperature "
        "and cannot calibrate surface temperature."
    )
