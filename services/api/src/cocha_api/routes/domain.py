"""Domain catalog endpoints with explicit availability envelopes."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from cocha_api.core.config import get_settings
from cocha_api.core.pagination import LimitQuery, OffsetQuery
from cocha_api.db.models import ModelRun, ProcessingRun, ScenarioRun, Station
from cocha_api.db.session import get_session
from cocha_api.schemas.availability import (
    IndicatorsResponse,
    JobItem,
    JobsResponse,
    ModelsResponse,
    ObservationExport,
    PilotTrendItem,
    PilotWindowScene,
    PilotWindowSummary,
    ReportsResponse,
    ScenariosResponse,
    SeriesResponse,
    StationItem,
    StationsResponse,
    StoredModelRef,
    StoredScenarioRef,
    TrendsResponse,
)
from cocha_api.science.evidence import load_snapshot
from cocha_api.science.gamc_catalog import MONICA_METADATA_PENDING, STATION_CATALOG_PROFILE
from cocha_api.science.indicators import (
    DISTRICT_VECTOR_REASON,
    SERIES_REASON,
    pilot_window_from_scenes,
)
from cocha_api.science.trends import TREND_PUBLICATION_REASON, descriptive_slope
from cocha_api.science.viability import (
    FUSION_BLOCKERS,
    FUSION_NOTE,
    SCENARIO_BLOCKERS,
    SCENARIO_REASON,
    fusion_viability,
)

router = APIRouter(prefix="/v1", tags=["domain"])

REPORTS_REASON = (
    "Formal district reports are unavailable because verified district indicators do not exist. "
    "observation_export, when present, is the pilot-window snapshot and is not a district report."
)
OBSERVATION_EXPORT_NOTE = "Observation export of the Landsat pilot window. Not a district report."
JOBS_EMPTY_REASON = "No processing runs are recorded."


def _pilot_window() -> PilotWindowSummary | None:
    snapshot = load_snapshot(get_settings().evidence_path)
    if snapshot is None or not snapshot.scenes:
        return None
    view = pilot_window_from_scenes(snapshot.scenes)
    return PilotWindowSummary(
        note=view.note,
        scenes=[
            PilotWindowScene(
                scene_id=scene.scene_id, lst_mean=scene.lst_mean, ndvi_mean=scene.ndvi_mean
            )
            for scene in view.scenes
        ],
    )


@router.get("/indicators", response_model=IndicatorsResponse)
def list_indicators(limit: LimitQuery = 50, offset: OffsetQuery = 0) -> IndicatorsResponse:
    return IndicatorsResponse(
        status="unavailable",
        reason=DISTRICT_VECTOR_REASON,
        items=[],
        limit=limit,
        offset=offset,
        pilot_window=_pilot_window(),
    )


@router.get("/series", response_model=SeriesResponse)
def list_series(limit: LimitQuery = 50, offset: OffsetQuery = 0) -> SeriesResponse:
    return SeriesResponse(
        status="unavailable",
        reason=SERIES_REASON,
        items=[],
        limit=limit,
        offset=offset,
    )


@router.get("/trends", response_model=TrendsResponse)
def list_trends(limit: LimitQuery = 50, offset: OffsetQuery = 0) -> TrendsResponse:
    # Official district trends stay unavailable. Pilot slopes are descriptive only.
    pilot_trends: list[PilotTrendItem] = []
    snapshot = load_snapshot(get_settings().evidence_path)
    if snapshot is not None:
        for variable, values in (
            ("lst_mean", [scene.lst_mean for scene in snapshot.scenes]),
            ("ndvi_mean", [scene.ndvi_mean for scene in snapshot.scenes]),
        ):
            result = descriptive_slope(values, min_n=3)
            pilot_trends.append(
                PilotTrendItem(
                    variable=variable,
                    n_finite=result.n_finite,
                    min_n=result.min_n,
                    status=result.status,
                    slope_per_step=result.slope_per_step,
                    method=result.method,
                    note=(
                        f"{result.note} Scope is the Landsat pilot window only; "
                        "not a district trend or climate inference."
                    ),
                )
            )
    return TrendsResponse(
        status="unavailable",
        reason=TREND_PUBLICATION_REASON,
        items=[],
        limit=limit,
        offset=offset,
        pilot_trends=pilot_trends,
    )


@router.get("/stations", response_model=StationsResponse)
def list_stations(
    session: Annotated[Session, Depends(get_session)],
    limit: LimitQuery = 50,
    offset: OffsetQuery = 0,
) -> StationsResponse:
    total = session.scalar(select(func.count()).select_from(Station)) or 0
    if total == 0:
        return StationsResponse(
            status="empty",
            reason=(
                "No MONICA stations imported yet. Metadata pending "
                f"({', '.join(MONICA_METADATA_PENDING)}); analysis aggregates disabled."
            ),
            items=[
                StationItem(
                    source_id=profile["source_id"],
                    name=profile["name"],
                    described_location=profile.get("described_location"),
                    variable=profile.get("variable", "pm10"),
                    unit=profile.get("unit"),
                    unit_source=profile.get("unit_source"),
                    timezone=None,
                    analysis_enabled=False,
                    metadata_pending=list(MONICA_METADATA_PENDING),
                )
                for profile in STATION_CATALOG_PROFILE
            ],
            limit=limit,
            offset=offset,
        )

    rows = session.scalars(
        select(Station).order_by(Station.source_id, Station.id).limit(limit).offset(offset)
    ).all()
    items = [
        StationItem(
            id=row.id,
            source_id=row.source_id,
            name=row.name,
            latitude=row.latitude,
            longitude=row.longitude,
            elevation_m=row.elevation_m,
            variable="pm10",
            unit=row.unit_declared,
            timezone=row.timezone_declared,
            analysis_enabled=row.analysis_enabled,
            metadata_pending=list(row.metadata_pending or MONICA_METADATA_PENDING),
        )
        for row in rows
    ]
    return StationsResponse(
        status="available",
        reason=(
            None
            if any(item.analysis_enabled for item in items)
            else "Stations imported; analysis aggregates remain disabled while metadata is pending."
        ),
        items=items,
        limit=limit,
        offset=offset,
    )


@router.get("/models", response_model=ModelsResponse)
def list_models(
    session: Annotated[Session, Depends(get_session)],
    limit: LimitQuery = 50,
    offset: OffsetQuery = 0,
) -> ModelsResponse:
    verdict = fusion_viability()
    total = session.scalar(select(func.count()).select_from(ModelRun)) or 0
    items: list[StoredModelRef] = []
    if total:
        rows = session.scalars(
            select(ModelRun).order_by(ModelRun.created_at, ModelRun.id).limit(limit).offset(offset)
        ).all()
        items = [
            StoredModelRef(id=row.id, objective=row.objective, metrics_published=False)
            for row in rows
        ]
    return ModelsResponse(
        status="unavailable",
        reason=verdict.note,
        viability_note=FUSION_NOTE,
        blockers=list(FUSION_BLOCKERS),
        items=items,
        limit=limit,
        offset=offset,
    )


@router.get("/scenarios", response_model=ScenariosResponse)
def list_scenarios(
    session: Annotated[Session, Depends(get_session)],
    limit: LimitQuery = 50,
    offset: OffsetQuery = 0,
) -> ScenariosResponse:
    total = session.scalar(select(func.count()).select_from(ScenarioRun)) or 0
    items: list[StoredScenarioRef] = []
    if total:
        rows = session.scalars(
            select(ScenarioRun)
            .order_by(ScenarioRun.created_at, ScenarioRun.id)
            .limit(limit)
            .offset(offset)
        ).all()
        items = [StoredScenarioRef(id=row.id) for row in rows]
    return ScenariosResponse(
        status="unavailable",
        reason=SCENARIO_REASON,
        blockers=list(SCENARIO_BLOCKERS),
        items=items,
        limit=limit,
        offset=offset,
    )


def _job_item(row: ProcessingRun) -> JobItem:
    return JobItem(
        id=row.id,
        kind=row.kind,
        status=row.status,
        started_at=row.started_at,
        finished_at=row.finished_at,
    )


@router.get("/jobs", response_model=JobsResponse)
def list_jobs(
    session: Annotated[Session, Depends(get_session)],
    limit: LimitQuery = 50,
    offset: OffsetQuery = 0,
) -> JobsResponse:
    total = session.scalar(select(func.count()).select_from(ProcessingRun)) or 0
    if total == 0:
        return JobsResponse(
            status="empty",
            reason=JOBS_EMPTY_REASON,
            items=[],
            limit=limit,
            offset=offset,
        )
    rows = session.scalars(
        select(ProcessingRun)
        .order_by(ProcessingRun.created_at, ProcessingRun.id)
        .limit(limit)
        .offset(offset)
    ).all()
    return JobsResponse(
        status="available",
        reason=None,
        items=[_job_item(row) for row in rows],
        limit=limit,
        offset=offset,
    )


@router.get("/jobs/{job_id}", response_model=JobItem)
def get_job(
    job_id: UUID,
    session: Annotated[Session, Depends(get_session)],
) -> JobItem:
    row = session.get(ProcessingRun, job_id)
    if row is None:
        raise HTTPException(
            status_code=404,
            detail={"status": "empty", "reason": "Processing run not found"},
        )
    return _job_item(row)


@router.get("/reports", response_model=ReportsResponse)
def list_reports(limit: LimitQuery = 50, offset: OffsetQuery = 0) -> ReportsResponse:
    snapshot = load_snapshot(get_settings().evidence_path)
    export = None
    if snapshot is not None:
        export = ObservationExport(note=OBSERVATION_EXPORT_NOTE, evidence=snapshot)
    if export is None:
        return ReportsResponse(
            status="empty",
            reason="No observation snapshot is published for export.",
            items=[],
            limit=limit,
            offset=offset,
            observation_export=None,
        )
    return ReportsResponse(
        status="available",
        reason=REPORTS_REASON,
        items=[],
        limit=limit,
        offset=offset,
        observation_export=export,
    )
