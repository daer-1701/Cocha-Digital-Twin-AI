"""Domain catalog endpoints with explicit availability envelopes."""

from datetime import date, datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from cocha_api.core.auth import check_role
from cocha_api.core.config import get_settings
from cocha_api.core.pagination import LimitQuery, OffsetQuery
from cocha_api.db.models import (
    District,
    DistrictIndicator,
    ModelRun,
    Observation,
    ProcessingRun,
    ScenarioRun,
    Station,
    TrendResult,
)
from cocha_api.db.session import get_session
from cocha_api.schemas.availability import (
    AcceptedModelItem,
    DemoIndicatorItem,
    DemoTrendItem,
    IndicatorsResponse,
    JobItem,
    JobsResponse,
    ModelsResponse,
    ObservationExport,
    OfficialIndicatorItem,
    OfficialTrendItem,
    PilotTrendItem,
    PilotWindowScene,
    PilotWindowSummary,
    ReportsResponse,
    ScenariosResponse,
    SeriesResponse,
    StationItem,
    StationObservationItem,
    StationObservationsResponse,
    StationsResponse,
    StoredModelRef,
    StoredScenarioRef,
    TrendsResponse,
)
from cocha_api.science.demo_districts import DEMO_BOUNDARY_VERSION, geometries_from_query_rows
from cocha_api.science.evidence import load_snapshot
from cocha_api.science.gamc_catalog import MONICA_METADATA_PENDING, STATION_CATALOG_PROFILE
from cocha_api.science.indicators import (
    DEMO_INDICATORS_REASON,
    DISTRICT_VECTOR_REASON,
    SERIES_REASON,
    DemoCellMean,
    demo_indicator_means,
    pilot_window_from_scenes,
)
from cocha_api.science.trends import (
    TREND_PUBLICATION_REASON,
    DemoSeriesSlope,
    demo_series_slopes,
    descriptive_slope,
)
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
OFFICIAL_SERIES_REASON = (
    "Accepted zonal statistics on official boundary versions. Satellite-derived estimates: "
    "LST is land surface temperature, not air temperature. Compare periods only with "
    "valid_fraction and provenance in view."
)
OFFICIAL_TRENDS_REASON = (
    "official_trends were accepted after scientific review. They describe association over "
    "time, not causation. pilot_trends and demo_trends remain descriptive only."
)
ACCEPTED_MODELS_REASON = (
    "accepted_models carry version, uncertainty and domain of use. Outputs are estimates; "
    "inputs outside domain_of_use must be rejected. Stored drafts stay unpublished."
)


def _demo_geometries(session: Session):
    result = session.execute(
        select(
            District.number,
            District.name,
            District.boundary_version,
            func.ST_AsGeoJSON(District.geometry).label("geojson"),
        )
        .where(District.boundary_version == DEMO_BOUNDARY_VERSION)
        .order_by(District.number, District.id)
    )
    rows = result.all() if hasattr(result, "all") else None
    return geometries_from_query_rows(rows)


def _snapshot_scenes() -> list[object]:
    snapshot = load_snapshot(get_settings().evidence_path)
    if snapshot is None:
        return []
    return list(snapshot.scenes)


def _indicator_item(item: DemoCellMean) -> DemoIndicatorItem:
    return DemoIndicatorItem(
        district_number=item.district_number,
        district_name=item.district_name,
        scene_id=item.scene_id,
        variable=item.variable,
        nature=item.nature,
        district_indicator=item.district_indicator,
        boundary_version=item.boundary_version,
        value=item.value,
        units=item.units,
        n_valid=item.n_valid,
        n_missing=item.n_missing,
        valid_fraction=item.valid_fraction,
        statistic=item.statistic,
    )


def _demo_trend_item(item: DemoSeriesSlope) -> DemoTrendItem:
    return DemoTrendItem(
        district_number=item.district_number,
        district_name=item.district_name,
        variable=item.variable,
        nature=item.nature,
        district_trend=item.district_trend,
        boundary_version=item.boundary_version,
        scene_ids=list(item.scene_ids),
        values=list(item.values),
        n_finite=item.n_finite,
        min_n=item.min_n,
        status=item.status,
        slope_per_step=item.slope_per_step,
        method=item.method,
        publishes_inference=False,
        note=item.note,
    )


def _pilot_window() -> PilotWindowSummary | None:
    snapshot = load_snapshot(get_settings().evidence_path)
    if snapshot is None or not snapshot.scenes:
        return None
    view = pilot_window_from_scenes(snapshot.scenes)
    return PilotWindowSummary(
        note=view.note,
        scenes=[
            PilotWindowScene(
                scene_id=scene.scene_id,
                acquired_at=next(s.acquired_at for s in snapshot.scenes if s.id == scene.scene_id),
                lst_mean=scene.lst_mean,
                ndvi_mean=scene.ndvi_mean,
            )
            for scene in view.scenes
        ],
    )


@router.get("/indicators", response_model=IndicatorsResponse)
def list_indicators(
    session: Annotated[Session, Depends(get_session)],
    limit: LimitQuery = 50,
    offset: OffsetQuery = 0,
    scene_id: Annotated[str | None, Query(min_length=1, max_length=200)] = None,
) -> IndicatorsResponse:
    geometries = _demo_geometries(session)
    if not geometries:
        return IndicatorsResponse(
            status="unavailable",
            reason=DISTRICT_VECTOR_REASON,
            items=[],
            limit=limit,
            offset=offset,
            pilot_window=_pilot_window(),
        )
    scenes = _snapshot_scenes()
    if not scenes:
        return IndicatorsResponse(
            status="empty",
            reason="No pilot scenes are available for the demo rectangles.",
            limit=limit,
            offset=offset,
        )
    if scene_id is None:
        selected = max(scenes, key=lambda scene: (scene.acquired_at, scene.id))
    else:
        selected = next((scene for scene in scenes if scene.id == scene_id), None)
        if selected is None:
            raise HTTPException(status_code=404, detail="Pilot scene not found")
    means = demo_indicator_means(geometries, [selected])
    return IndicatorsResponse(
        status="available",
        reason=DEMO_INDICATORS_REASON,
        items=[_indicator_item(item) for item in means[offset : offset + limit]],
        selected_scene_id=selected.id,
        limit=limit,
        offset=offset,
        pilot_window=_pilot_window(),
    )


def _official_indicator_filters() -> tuple:
    return (
        DistrictIndicator.publication_status == "accepted",
        DistrictIndicator.boundary_version == District.boundary_version,
        District.boundary_version != DEMO_BOUNDARY_VERSION,
    )


def _official_indicator_item(row: DistrictIndicator, number: int, name: str):
    return OfficialIndicatorItem(
        id=row.id,
        district_id=row.district_id,
        district_number=number,
        district_name=name,
        boundary_version=row.boundary_version,
        variable=row.variable,
        statistic=row.statistic,
        period_start=row.period_start,
        period_end=row.period_end,
        value=row.value,
        units=row.units,
        valid_fraction=row.valid_fraction,
        n=row.n,
        accepted_at=row.accepted_at,
        processing_run_id=row.processing_run_id,
        provenance=row.provenance,
    )


@router.get("/series", response_model=SeriesResponse)
def list_series(
    session: Annotated[Session, Depends(get_session)],
    limit: LimitQuery = 50,
    offset: OffsetQuery = 0,
    boundary_version: Annotated[str | None, Query(min_length=1, max_length=100)] = None,
    district_number: Annotated[int | None, Query(ge=1, le=15)] = None,
    variable: Annotated[str | None, Query(min_length=1, max_length=64)] = None,
    statistic: Annotated[str | None, Query(min_length=1, max_length=64)] = None,
    period_from: date | None = None,
    period_to: date | None = None,
) -> SeriesResponse:
    """Accepted official zonal statistics. Demo rectangles never appear here."""

    if period_from and period_to and period_from > period_to:
        raise HTTPException(status_code=422, detail="period_from must not exceed period_to")
    base = _official_indicator_filters()
    joined = (
        select(func.count())
        .select_from(DistrictIndicator)
        .join(District, DistrictIndicator.district_id == District.id)
    )
    if not (session.scalar(joined.where(*base)) or 0):
        return SeriesResponse(
            status="unavailable", reason=SERIES_REASON, items=[], limit=limit, offset=offset
        )
    versions = list(
        session.scalars(
            select(District.boundary_version)
            .join(DistrictIndicator, DistrictIndicator.district_id == District.id)
            .where(*base)
            .distinct()
            .order_by(District.boundary_version)
        )
    )
    filters = list(base)
    if boundary_version is not None:
        filters.append(District.boundary_version == boundary_version)
    if district_number is not None:
        filters.append(District.number == district_number)
    if variable is not None:
        filters.append(DistrictIndicator.variable == variable)
    if statistic is not None:
        filters.append(DistrictIndicator.statistic == statistic)
    if period_from is not None:
        filters.append(DistrictIndicator.period_start >= period_from)
    if period_to is not None:
        filters.append(DistrictIndicator.period_end <= period_to)
    rows = session.execute(
        select(DistrictIndicator, District.number, District.name)
        .join(District, DistrictIndicator.district_id == District.id)
        .where(*filters)
        .order_by(
            District.boundary_version,
            District.number,
            DistrictIndicator.variable,
            DistrictIndicator.statistic,
            DistrictIndicator.period_start,
            DistrictIndicator.id,
        )
        .limit(limit + 1)
        .offset(offset)
    ).all()
    return SeriesResponse(
        status="available" if rows else "empty",
        reason=OFFICIAL_SERIES_REASON if rows else "No accepted rows match the filters.",
        items=[],
        official_items=[_official_indicator_item(*row) for row in rows[:limit]],
        boundary_versions=versions,
        has_more=len(rows) > limit,
        limit=limit,
        offset=offset,
    )


@router.get("/trends", response_model=TrendsResponse)
def list_trends(
    session: Annotated[Session, Depends(get_session)],
    limit: LimitQuery = 50,
    offset: OffsetQuery = 0,
) -> TrendsResponse:
    # Official district trends stay unavailable. Pilot and demo slopes are descriptive only.
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
    geometries = _demo_geometries(session)
    demo_trends: list[DemoTrendItem] = []
    if geometries:
        means = demo_indicator_means(geometries, _snapshot_scenes())
        demo_trends = [
            _demo_trend_item(item) for item in demo_series_slopes(means)[offset : offset + limit]
        ]
    official_trends: list[OfficialTrendItem] = []
    accepted = TrendResult.publication_status == "accepted"
    if session.scalar(select(func.count()).select_from(TrendResult).where(accepted)) or 0:
        official_trends = [
            OfficialTrendItem(
                id=row.id,
                series_key=row.series_key,
                method=row.method,
                slope=row.slope,
                slope_units=row.slope_units,
                interval_low=row.interval_low,
                interval_high=row.interval_high,
                p_value=row.p_value,
                p_adjusted=row.p_adjusted,
                hypothesis=row.hypothesis,
                accepted_at=row.accepted_at,
                processing_run_id=row.processing_run_id,
            )
            for row in session.scalars(
                select(TrendResult)
                .where(accepted)
                .order_by(TrendResult.series_key, TrendResult.id)
                .limit(limit)
                .offset(offset)
            )
        ]
    if official_trends:
        return TrendsResponse(
            status="available",
            reason=OFFICIAL_TRENDS_REASON,
            items=[],
            limit=limit,
            offset=offset,
            pilot_trends=pilot_trends,
            demo_trends=demo_trends,
            official_trends=official_trends,
        )
    reason = TREND_PUBLICATION_REASON
    if demo_trends:
        reason = (
            f"{TREND_PUBLICATION_REASON} "
            "demo_trends are descriptive slopes on synthetic rectangles only."
        )
    return TrendsResponse(
        status="unavailable",
        reason=reason,
        items=[],
        limit=limit,
        offset=offset,
        pilot_trends=pilot_trends,
        demo_trends=demo_trends,
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
            described_location=next(
                (
                    p.get("described_location")
                    for p in STATION_CATALOG_PROFILE
                    if p["source_id"] == row.source_id
                ),
                None,
            ),
            unit_source=next(
                (
                    p.get("unit_source")
                    for p in STATION_CATALOG_PROFILE
                    if p["source_id"] == row.source_id
                ),
                None,
            ),
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
    accepted = ModelRun.publication_status == "accepted"
    if session.scalar(select(func.count()).select_from(ModelRun).where(accepted)) or 0:
        accepted_models = [
            AcceptedModelItem(
                id=row.id,
                objective=row.objective,
                model_version=row.model_version,
                variables=row.variables,
                validation_partition=row.validation_partition,
                metrics=row.metrics,
                uncertainty=row.uncertainty,
                domain_of_use=row.domain_of_use,
                artifact_checksum_sha256=row.artifact_checksum_sha256,
                accepted_at=row.accepted_at,
            )
            for row in session.scalars(
                select(ModelRun)
                .where(accepted)
                .order_by(ModelRun.accepted_at.desc(), ModelRun.id)
                .limit(limit)
                .offset(offset)
            )
        ]
        return ModelsResponse(
            status="available",
            reason=ACCEPTED_MODELS_REASON,
            viability_note=FUSION_NOTE,
            blockers=[],
            items=items,
            accepted_models=accepted_models,
            limit=limit,
            offset=offset,
        )
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
        attempt=row.attempt,
        heartbeat_at=row.heartbeat_at,
        error_code=row.error_code,
    )


@router.get("/jobs", response_model=JobsResponse)
def list_jobs(
    session: Annotated[Session, Depends(get_session)],
    limit: LimitQuery = 50,
    offset: OffsetQuery = 0,
    kind: Annotated[str | None, Query(min_length=1, max_length=100)] = None,
    status: Annotated[str | None, Query(min_length=1, max_length=40)] = None,
) -> JobsResponse:
    filters = []
    if kind is not None:
        filters.append(ProcessingRun.kind == kind)
    if status is not None:
        filters.append(ProcessingRun.status == status)
    total = session.scalar(select(func.count()).select_from(ProcessingRun).where(*filters)) or 0
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
        .where(*filters)
        .order_by(ProcessingRun.created_at.desc(), ProcessingRun.id.desc())
        .limit(limit + 1)
        .offset(offset)
    ).all()
    return JobsResponse(
        status="available",
        reason=None,
        items=[_job_item(row) for row in rows[:limit]],
        has_more=len(rows) > limit,
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


@router.get("/stations/{station_id}/observations", response_model=StationObservationsResponse)
def station_observations(
    station_id: UUID,
    session: Annotated[Session, Depends(get_session)],
    limit: LimitQuery = 50,
    offset: OffsetQuery = 0,
    quality_flag: Annotated[str | None, Query(min_length=1, max_length=40)] = None,
    observed_from: datetime | None = None,
    observed_to: datetime | None = None,
    authorization: Annotated[str | None, Header()] = None,
) -> StationObservationsResponse:
    """Review imported records without publishing physical aggregates or calibration.

    observed_from/observed_to compare against the naive source timestamps; the
    station timezone is unverified, so do not send offsets.
    """
    settings = get_settings()
    if not settings.monica_review_enabled:
        station = session.get(Station, station_id)
        if station is None:
            raise HTTPException(status_code=404, detail="Station not found")
        return StationObservationsResponse(
            status="unavailable",
            reason=(
                "Local record review is disabled. Confirm permission before exposing imported data."
            ),
            station_id=station.id,
            station_name=station.name,
            limit=limit,
            offset=offset,
        )
    check_role("reviewer", authorization, settings)
    for bound in (observed_from, observed_to):
        if bound is not None and bound.tzinfo is not None:
            raise HTTPException(
                status_code=422,
                detail="Source timestamps have no verified timezone; send naive datetimes",
            )
    if observed_from and observed_to and observed_from > observed_to:
        raise HTTPException(status_code=422, detail="observed_from must not exceed observed_to")
    station = session.get(Station, station_id)
    if station is None:
        raise HTTPException(status_code=404, detail="Station not found")
    filters = [Observation.station_id == station_id, Observation.variable == "pm10"]
    if quality_flag is not None:
        filters.append(Observation.quality_flag == quality_flag)
    if observed_from is not None:
        filters.append(Observation.observed_at >= observed_from)
    if observed_to is not None:
        filters.append(Observation.observed_at <= observed_to)
    rows = session.scalars(
        select(Observation)
        .where(*filters)
        .order_by(Observation.observed_at.desc(), Observation.id.desc())
        .offset(offset)
        .limit(limit + 1)
    ).all()
    return StationObservationsResponse(
        status="available" if rows else "empty",
        reason=(
            "Imported records for quality review only. Timezone, instrument QA and "
            "redistribution permission require verification. Not an LST calibration."
        ),
        station_id=station.id,
        station_name=station.name,
        timezone=station.timezone_declared,
        limit=limit,
        offset=offset,
        has_more=len(rows) > limit,
        items=[
            StationObservationItem(
                id=row.id,
                observed_at=row.observed_at,
                observed_at_raw=row.observed_at_raw,
                value=float(row.value) if row.value is not None else None,
                unit=row.unit,
                quality_flag=row.quality_flag,
                processing_run_id=row.processing_run_id,
            )
            for row in rows[:limit]
        ],
    )


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
