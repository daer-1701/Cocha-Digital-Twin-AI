"""Shared availability envelopes for unfinished or empty scientific resources."""

from datetime import datetime
from typing import Literal
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
    lst_mean: float | None = None
    ndvi_mean: float | None = None
    scope: Literal["pilot_window"] = "pilot_window"
    district_indicator: Literal[False] = False


class PilotWindowSummary(AvailabilityModel):
    scope: Literal["pilot_window"] = "pilot_window"
    label: Literal["pilot-only"] = "pilot-only"
    note: str
    scenes: list[PilotWindowScene] = Field(default_factory=list)


class IndicatorsResponse(AvailabilityEnvelope, PaginationParams):
    items: list[dict] = Field(default_factory=list)
    pilot_window: PilotWindowSummary | None = None


class SeriesResponse(AvailabilityEnvelope, PaginationParams):
    items: list[dict] = Field(default_factory=list)


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


class TrendsResponse(AvailabilityEnvelope, PaginationParams):
    items: list[dict] = Field(default_factory=list)
    # Pilot-only descriptive slopes from the explorer snapshot; never district trends.
    pilot_trends: list[PilotTrendItem] = Field(default_factory=list)


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


class ModelsResponse(AvailabilityEnvelope, PaginationParams):
    items: list[StoredModelRef] = Field(default_factory=list)
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


class JobsResponse(AvailabilityEnvelope, PaginationParams):
    items: list[JobItem] = Field(default_factory=list)


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


class TerritoriesResponse(AvailabilityEnvelope):
    pilot: PilotTerritory
    wms_layers: list[WmsLayerAvailability]
    vector_districts: VectorDistrictsAvailability
    generated_at: datetime | None = None
