from datetime import date, datetime
from decimal import Decimal
from typing import Any
from uuid import UUID, uuid4

from geoalchemy2 import Geometry
from geoalchemy2.elements import WKBElement
from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


PUBLICATION_STATUSES = ("draft", "accepted", "withdrawn")
JOB_STATUSES = ("queued", "running", "completed", "failed", "interrupted", "recorded")
_PUBLICATION_CHECK = "publication_status IN ('draft', 'accepted', 'withdrawn')"
_ACCEPTANCE_CHECK = (
    "publication_status <> 'accepted' OR (accepted_by IS NOT NULL AND accepted_at IS NOT NULL)"
)


class Dataset(Base):
    __tablename__ = "datasets"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    name: Mapped[str] = mapped_column(String(200))
    source_url: Mapped[str] = mapped_column(Text)
    product_version: Mapped[str] = mapped_column(String(100))
    license: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class District(Base):
    __tablename__ = "districts"
    # Demo rectangles and each official boundary version coexist without overwriting.
    __table_args__ = (
        CheckConstraint("number BETWEEN 1 AND 15", name="district_number_range"),
        UniqueConstraint("boundary_version", "number", name="districts_boundary_number_key"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    number: Mapped[int] = mapped_column()
    name: Mapped[str] = mapped_column(String(200))
    source_url: Mapped[str] = mapped_column(Text)
    boundary_version: Mapped[str] = mapped_column(String(100))
    geometry: Mapped[WKBElement] = mapped_column(
        Geometry(geometry_type="MULTIPOLYGON", srid=4326, spatial_index=True)
    )


class ProcessingRun(Base):
    __tablename__ = "processing_runs"
    __table_args__ = (
        Index(
            "processing_runs_idempotency_key_uq",
            "idempotency_key",
            unique=True,
            postgresql_where=text("idempotency_key IS NOT NULL"),
        ),
        Index("processing_runs_status_heartbeat_idx", "status", "heartbeat_at"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    kind: Mapped[str] = mapped_column(String(100))
    status: Mapped[str] = mapped_column(String(40))
    idempotency_key: Mapped[str | None] = mapped_column(String(200), nullable=True)
    attempt: Mapped[int] = mapped_column(Integer, default=1, server_default="1")
    heartbeat_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    error_code: Mapped[str | None] = mapped_column(String(100), nullable=True)
    git_commit: Mapped[str | None] = mapped_column(String(64), nullable=True)
    environment_version: Mapped[str | None] = mapped_column(String(100), nullable=True)
    parameters: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)


class Asset(Base):
    __tablename__ = "assets"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    dataset_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("datasets.id", ondelete="SET NULL"), nullable=True
    )
    processing_run_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("processing_runs.id", ondelete="SET NULL"), nullable=True
    )
    uri: Mapped[str] = mapped_column(Text)
    checksum_sha256: Mapped[str] = mapped_column(String(64))
    media_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    acquired_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    crs: Mapped[str | None] = mapped_column(String(64), nullable=True)
    resolution_m: Mapped[float | None] = mapped_column(Float, nullable=True)
    units: Mapped[str | None] = mapped_column(String(64), nullable=True)
    qa_mask_uri: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Station(Base):
    __tablename__ = "stations"
    __table_args__ = (UniqueConstraint("source_id", name="stations_source_id_key"),)

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    source_id: Mapped[str] = mapped_column(String(100))
    name: Mapped[str] = mapped_column(String(200))
    network: Mapped[str] = mapped_column(String(100), default="monica")
    # Coordinates remain nullable until an official source is verified.
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    elevation_m: Mapped[float | None] = mapped_column(Float, nullable=True)
    unit_declared: Mapped[str | None] = mapped_column(String(64), nullable=True)
    timezone_declared: Mapped[str | None] = mapped_column(String(64), nullable=True)
    analysis_enabled: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    metadata_pending: Mapped[list[Any] | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class Observation(Base):
    __tablename__ = "observations"
    __table_args__ = (
        UniqueConstraint(
            "station_id",
            "variable",
            "observed_at",
            name="observations_station_variable_time_key",
        ),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    station_id: Mapped[UUID] = mapped_column(ForeignKey("stations.id", ondelete="CASCADE"))
    processing_run_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("processing_runs.id", ondelete="SET NULL"), nullable=True
    )
    variable: Mapped[str] = mapped_column(String(64))
    # ug/m3 may be stored from the Red MoniCA report catalog, not the CSV header.
    # Timezone stays absent: observed_at is naive and must not be labeled UTC.
    unit: Mapped[str | None] = mapped_column(String(64), nullable=True)
    # Naive timestamp: source CSVs have no timezone offset; do not label as UTC.
    observed_at: Mapped[datetime] = mapped_column(DateTime(timezone=False))
    observed_at_raw: Mapped[str] = mapped_column(Text)
    value: Mapped[Decimal | None] = mapped_column(Numeric(14, 4), nullable=True)
    quality_flag: Mapped[str] = mapped_column(String(40))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class DistrictIndicator(Base):
    __tablename__ = "district_indicators"
    __table_args__ = (
        UniqueConstraint(
            "district_id",
            "boundary_version",
            "variable",
            "period_start",
            "period_end",
            "statistic",
            "processing_run_id",
            name="district_indicators_identity_key",
            postgresql_nulls_not_distinct=True,
        ),
        CheckConstraint(_PUBLICATION_CHECK, name="district_indicators_publication_status"),
        CheckConstraint(_ACCEPTANCE_CHECK, name="district_indicators_acceptance"),
        Index(
            "district_indicators_publication_idx",
            "publication_status",
            "boundary_version",
            "variable",
            "period_start",
        ),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    district_id: Mapped[UUID] = mapped_column(ForeignKey("districts.id", ondelete="CASCADE"))
    boundary_version: Mapped[str] = mapped_column(String(100))
    variable: Mapped[str] = mapped_column(String(64))
    statistic: Mapped[str] = mapped_column(String(64))
    period_start: Mapped[date] = mapped_column(Date)
    period_end: Mapped[date] = mapped_column(Date)
    value: Mapped[float | None] = mapped_column(Float, nullable=True)
    units: Mapped[str | None] = mapped_column(String(64), nullable=True)
    valid_fraction: Mapped[float | None] = mapped_column(Float, nullable=True)
    n: Mapped[int | None] = mapped_column(Integer, nullable=True)
    processing_run_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("processing_runs.id", ondelete="SET NULL"), nullable=True
    )
    # Product/version, QA mask, resolution and coverage of the source rasters.
    provenance: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    publication_status: Mapped[str] = mapped_column(
        String(20), default="draft", server_default="draft"
    )
    accepted_by: Mapped[str | None] = mapped_column(String(100), nullable=True)
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class TrendResult(Base):
    __tablename__ = "trend_results"
    __table_args__ = (
        CheckConstraint(_PUBLICATION_CHECK, name="trend_results_publication_status"),
        CheckConstraint(_ACCEPTANCE_CHECK, name="trend_results_acceptance"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    series_key: Mapped[str] = mapped_column(String(200))
    method: Mapped[str] = mapped_column(String(100))
    slope: Mapped[float | None] = mapped_column(Float, nullable=True)
    slope_units: Mapped[str | None] = mapped_column(String(64), nullable=True)
    interval_low: Mapped[float | None] = mapped_column(Float, nullable=True)
    interval_high: Mapped[float | None] = mapped_column(Float, nullable=True)
    p_value: Mapped[float | None] = mapped_column(Float, nullable=True)
    p_adjusted: Mapped[float | None] = mapped_column(Float, nullable=True)
    hypothesis: Mapped[str | None] = mapped_column(Text, nullable=True)
    processing_run_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("processing_runs.id", ondelete="SET NULL"), nullable=True
    )
    publication_status: Mapped[str] = mapped_column(
        String(20), default="draft", server_default="draft"
    )
    accepted_by: Mapped[str | None] = mapped_column(String(100), nullable=True)
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ModelRun(Base):
    __tablename__ = "model_runs"
    __table_args__ = (
        CheckConstraint(_PUBLICATION_CHECK, name="model_runs_publication_status"),
        CheckConstraint(
            "publication_status <> 'accepted' OR ("
            "accepted_by IS NOT NULL AND accepted_at IS NOT NULL "
            "AND model_version IS NOT NULL AND artifact_checksum_sha256 IS NOT NULL "
            "AND uncertainty IS NOT NULL AND domain_of_use IS NOT NULL)",
            name="model_runs_acceptance",
        ),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    objective: Mapped[str] = mapped_column(String(200))
    variables: Mapped[list[Any] | None] = mapped_column(JSONB, nullable=True)
    validation_partition: Mapped[str | None] = mapped_column(Text, nullable=True)
    metrics: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    artifact_uri: Mapped[str | None] = mapped_column(Text, nullable=True)
    artifact_checksum_sha256: Mapped[str | None] = mapped_column(String(64), nullable=True)
    provenance: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    processing_run_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("processing_runs.id", ondelete="SET NULL"), nullable=True
    )
    model_version: Mapped[str | None] = mapped_column(String(64), nullable=True)
    uncertainty: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    domain_of_use: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    publication_status: Mapped[str] = mapped_column(
        String(20), default="draft", server_default="draft"
    )
    accepted_by: Mapped[str | None] = mapped_column(String(100), nullable=True)
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AssistantRequest(Base):
    """Central Gemini budget ledger. One row per idempotent request_id."""

    __tablename__ = "assistant_requests"
    __table_args__ = (
        CheckConstraint("status IN ('reserved', 'settled')", name="assistant_requests_status"),
        CheckConstraint("reserved_usd > 0", name="assistant_requests_reserved_positive"),
        CheckConstraint(
            "charged_usd IS NULL OR charged_usd >= 0", name="assistant_requests_charged_nonneg"
        ),
    )

    request_id: Mapped[str] = mapped_column(String(100), primary_key=True)
    model: Mapped[str] = mapped_column(String(100))
    status: Mapped[str] = mapped_column(String(20))
    reserved_usd: Mapped[Decimal] = mapped_column(Numeric(12, 6))
    charged_usd: Mapped[Decimal | None] = mapped_column(Numeric(12, 6), nullable=True)
    input_tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)
    output_tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # Stored answer so a retried request_id replays instead of paying twice.
    response: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    settled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class ScenarioRun(Base):
    __tablename__ = "scenario_runs"
    __table_args__ = (
        CheckConstraint(_PUBLICATION_CHECK, name="scenario_runs_publication_status"),
        CheckConstraint(_ACCEPTANCE_CHECK, name="scenario_runs_acceptance"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    model_run_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("model_runs.id", ondelete="SET NULL"), nullable=True
    )
    assumptions: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    intervention: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    result: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    uncertainty: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    processing_run_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("processing_runs.id", ondelete="SET NULL"), nullable=True
    )
    publication_status: Mapped[str] = mapped_column(
        String(20), default="draft", server_default="draft"
    )
    accepted_by: Mapped[str | None] = mapped_column(String(100), nullable=True)
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
