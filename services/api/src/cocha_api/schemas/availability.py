"""Shared availability envelopes for unfinished or empty scientific resources."""

from datetime import date, datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from cocha_api.schemas.explorer import Snapshot

AvailabilityStatus = Literal["available", "empty", "unavailable"]


class AvailabilityModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class AvailabilityEnvelope(AvailabilityModel):
    status: AvailabilityStatus
    reason: str | None = None


class PaginationParams(AvailabilityModel):
    limit: int = Field(ge=1, le=100)
    offset: int = Field(ge=0)


class PilotWindowScene(AvailabilityModel):
    scene_id: str
    acquired_at: datetime | None = None
    lst_mean: float | None = None
    ndvi_mean: float | None = None
    scope: Literal["pilot_window"] = "pilot_window"
    district_indicator: Literal[False] = False


class PilotWindowSummary(AvailabilityModel):
    scope: Literal["pilot_window"] = "pilot_window"
    label: Literal["pilot-only"] = "pilot-only"
    note: str
    scenes: list[PilotWindowScene] = Field(default_factory=list)


class DemoIndicatorItem(AvailabilityModel):
    """Centroid mean inside a synthetic rectangle. Not an official district indicator."""

    district_number: int = Field(ge=1, le=15)
    district_name: str
    scene_id: str
    variable: Literal["lst_celsius", "ndvi"]
    nature: Literal["demo_synthetic"] = "demo_synthetic"
    district_indicator: Literal["demo"] = "demo"
    boundary_version: str
    value: float | None = None
    units: Literal["celsius", "dimensionless"]
    n_valid: int = Field(ge=0)
    n_missing: int = Field(ge=0)
    valid_fraction: float | None = None
    statistic: Literal["pilot_cell_centroid_mean"] = "pilot_cell_centroid_mean"


class IndicatorsResponse(AvailabilityEnvelope, PaginationParams):
    items: list[DemoIndicatorItem] = Field(default_factory=list)
    selected_scene_id: str | None = None
    pilot_window: PilotWindowSummary | None = None


class OfficialIndicatorItem(AvailabilityModel):
    """Accepted zonal statistic on an official boundary version.

    Satellite-derived estimate; LST is land surface temperature, not air temperature.
    """

    id: UUID
    district_id: UUID
    district_number: int = Field(ge=1, le=15)
    district_name: str
    boundary_version: str
    variable: str
    statistic: str
    period_start: date
    period_end: date
    value: float | None = None
    units: str | None = None
    valid_fraction: float | None = None
    n: int | None = None
    nature: Literal["satellite_derived"] = "satellite_derived"
    publication_status: Literal["accepted"] = "accepted"
    accepted_at: datetime | None = None
    processing_run_id: UUID | None = None
    provenance: dict[str, Any] | None = None


class SeriesResponse(AvailabilityEnvelope, PaginationParams):
    # Kept untyped for demo/fixture payloads; official rows use official_items.
    items: list[dict] = Field(default_factory=list)
    official_items: list[OfficialIndicatorItem] = Field(default_factory=list)
    boundary_versions: list[str] = Field(default_factory=list)
    has_more: bool = False


class PilotTrendItem(AvailabilityModel):
    variable: Literal["lst_mean", "ndvi_mean"]
    scope: Literal["pilot_window"] = "pilot_window"
    district_trend: Literal[False] = False
    n_finite: int
    min_n: int
    status: Literal["descriptive", "inconclusive"]
    slope_per_step: float | None
    method: str
    publishes_inference: Literal[False] = False
    note: str


class DemoTrendItem(AvailabilityModel):
    """Descriptive slope on a demo rectangle series. Official inference stays blocked."""

    district_number: int = Field(ge=1, le=15)
    district_name: str
    variable: Literal["lst_celsius", "ndvi"]
    nature: Literal["demo_synthetic"] = "demo_synthetic"
    district_trend: Literal["demo"] = "demo"
    boundary_version: str
    scene_ids: list[str]
    values: list[float | None]
    n_finite: int = Field(ge=0)
    min_n: int = Field(ge=2)
    status: Literal["descriptive", "inconclusive"]
    slope_per_step: float | None
    method: str
    publishes_inference: Literal[False] = False
    note: str


class OfficialTrendItem(AvailabilityModel):
    """Trend accepted after scientific review. Association, not causation."""

    id: UUID
    series_key: str
    method: str
    slope: float | None = None
    slope_units: str | None = None
    interval_low: float | None = None
    interval_high: float | None = None
    p_value: float | None = None
    p_adjusted: float | None = None
    hypothesis: str | None = None
    publication_status: Literal["accepted"] = "accepted"
    accepted_at: datetime | None = None
    processing_run_id: UUID | None = None


class TrendsResponse(AvailabilityEnvelope, PaginationParams):
    items: list[dict] = Field(default_factory=list)
    # Pilot-only descriptive slopes from the explorer snapshot; never district trends.
    pilot_trends: list[PilotTrendItem] = Field(default_factory=list)
    # Present only when demo districts and pilot scenes were aggregated. Not official.
    demo_trends: list[DemoTrendItem] = Field(default_factory=list)
    official_trends: list[OfficialTrendItem] = Field(default_factory=list)


class StationItem(AvailabilityModel):
    id: UUID | None = None
    source_id: str
    name: str
    described_location: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    elevation_m: float | None = None
    variable: str = "pm10"
    unit: str | None = None
    unit_source: str | None = None
    timezone: str | None = None
    analysis_enabled: bool = False
    metadata_pending: list[str] = Field(default_factory=list)


class StationsResponse(AvailabilityEnvelope, PaginationParams):
    items: list[StationItem] = Field(default_factory=list)


class StoredModelRef(AvailabilityModel):
    id: UUID
    objective: str
    metrics_published: Literal[False] = False


class AcceptedModelItem(AvailabilityModel):
    """Model accepted with version, uncertainty and domain of use. Outputs are estimates."""

    id: UUID
    objective: str
    model_version: str
    variables: list[Any] | None = None
    validation_partition: str | None = None
    metrics: dict[str, Any] | None = None
    uncertainty: dict[str, Any]
    domain_of_use: dict[str, Any]
    artifact_checksum_sha256: str
    nature: Literal["estimate"] = "estimate"
    accepted_at: datetime | None = None


class ModelsResponse(AvailabilityEnvelope, PaginationParams):
    items: list[StoredModelRef] = Field(default_factory=list)
    accepted_models: list[AcceptedModelItem] = Field(default_factory=list)
    viability_note: str | None = None
    blockers: list[str] = Field(default_factory=list)


class StoredScenarioRef(AvailabilityModel):
    id: UUID
    evaluated: Literal[False] = False
    note: str = "Stored row is not an evaluated scenario."


class ScenariosResponse(AvailabilityEnvelope, PaginationParams):
    items: list[StoredScenarioRef] = Field(default_factory=list)
    blockers: list[str] = Field(default_factory=list)


class JobItem(AvailabilityModel):
    id: UUID
    kind: str
    status: str
    started_at: datetime | None = None
    finished_at: datetime | None = None
    attempt: int | None = None
    heartbeat_at: datetime | None = None
    error_code: str | None = None


class JobsResponse(AvailabilityEnvelope, PaginationParams):
    items: list[JobItem] = Field(default_factory=list)
    has_more: bool = False


class StationObservationItem(AvailabilityModel):
    id: UUID
    # Naive local timestamp as parsed; timezone is unverified. observed_at_raw is the source text.
    observed_at: datetime
    observed_at_raw: str | None = None
    value: float | None = None
    unit: str | None = None
    quality_flag: str
    processing_run_id: UUID | None = None


class StationObservationsResponse(AvailabilityEnvelope, PaginationParams):
    station_id: UUID
    station_name: str
    variable: Literal["pm10"] = "pm10"
    scope: Literal["imported_records_review"] = "imported_records_review"
    analysis_enabled: Literal[False] = False
    timezone: str | None = None
    has_more: bool = False
    items: list[StationObservationItem] = Field(default_factory=list)


class ObservationExport(AvailabilityModel):
    kind: Literal["observation_export"] = "observation_export"
    scope: Literal["pilot_window"] = "pilot_window"
    district_report: Literal[False] = False
    note: str
    evidence: Snapshot


class ReportsResponse(AvailabilityEnvelope, PaginationParams):
    items: list[dict] = Field(default_factory=list)
    observation_export: ObservationExport | None = None


class PilotTerritory(AvailabilityModel):
    name: str
    status: Literal["available"] = "available"
    bounds_wgs84: tuple[float, float, float, float]
    source: str
    note: str


class WmsLayerAvailability(AvailabilityModel):
    name: str
    service_id: str
    status: Literal["available", "unavailable"]
    reason: str | None = None


class VectorDistrictsAvailability(AvailabilityModel):
    status: Literal["unavailable"] = "unavailable"
    reason: str


class OfficialDistrictItem(AvailabilityModel):
    id: UUID
    number: int = Field(ge=1, le=15)
    name: str
    boundary_version: str
    source_url: str
    # GeoJSON MultiPolygon in EPSG:4326, only when include_geometry=true.
    geometry: dict[str, Any] | None = None


class DistrictsResponse(AvailabilityEnvelope, PaginationParams):
    boundary_version: str | None = None
    boundary_versions: list[str] = Field(default_factory=list)
    items: list[OfficialDistrictItem] = Field(default_factory=list)
    has_more: bool = False


class TerritoriesResponse(AvailabilityEnvelope):
    pilot: PilotTerritory
    wms_layers: list[WmsLayerAvailability]
    vector_districts: VectorDistrictsAvailability
    generated_at: datetime | None = None
