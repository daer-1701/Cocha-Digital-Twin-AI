"""Idempotent MONICA PM10 import into stations/observations.

Sets unit_declared from the catalog source (ug/m3). Does not invent timezone
or coordinates. Keeps analysis_enabled=false while metadata remains pending.
PM10 is not air temperature and must not calibrate LST.
"""

from __future__ import annotations

import argparse
import hashlib
from datetime import UTC, datetime
from pathlib import Path
from uuid import UUID, uuid4

from cocha_api.db.models import Observation, ProcessingRun, Station
from cocha_api.db.session import get_engine
from cocha_api.science.gamc_catalog import MONICA_PM10_UNIT, MONICA_PM10_UNIT_SOURCE
from cocha_api.science.monica import MonicaRow, parse_monica_csv, station_import_profile
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

DEFAULT_FILES = (
    "red_monica.kanata (1).csv",
    "red_monica.semapa (1).csv",
)


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def ensure_station(session: Session, source_id: str) -> Station:
    profile = station_import_profile(source_id)
    existing = session.scalar(select(Station).where(Station.source_id == source_id))
    if existing is not None:
        existing.name = profile.name
        existing.analysis_enabled = False
        existing.unit_declared = profile.unit_declared
        existing.timezone_declared = None
        existing.metadata_pending = list(profile.metadata_pending)
        return existing
    station = Station(
        id=uuid4(),
        source_id=source_id,
        name=profile.name,
        network="monica",
        latitude=None,
        longitude=None,
        elevation_m=None,
        unit_declared=profile.unit_declared,
        timezone_declared=None,
        analysis_enabled=False,
        metadata_pending=list(profile.metadata_pending),
    )
    session.add(station)
    session.flush()
    return station


def upsert_observations(
    session: Session,
    station: Station,
    rows: list[MonicaRow],
    processing_run_id: UUID,
    *,
    unit: str,
) -> tuple[int, int]:
    inserted = 0
    existing = 0
    for row in rows:
        if row.observed_at is None or row.quality_flag == "duplicate":
            continue
        statement = (
            insert(Observation)
            .values(
                id=uuid4(),
                station_id=station.id,
                processing_run_id=processing_run_id,
                variable="pm10",
                unit=unit,
                observed_at=row.observed_at,
                observed_at_raw=row.observed_at_raw,
                value=row.value,
                quality_flag=row.quality_flag,
            )
            .on_conflict_do_nothing(
                constraint="observations_station_variable_time_key",
            )
            .returning(Observation.id, Observation.created_at)
        )
        # Preserve the first canonical record and its provenance, including on reimport.
        result = session.execute(statement).one_or_none()
        inserted += result is not None
        existing += result is None
    return inserted, existing


def import_file(session: Session, path: Path, processing_run: ProcessingRun) -> dict[str, object]:
    text = path.read_text(encoding="utf-8")
    summary = parse_monica_csv(text, source_label=path.name)
    station_ids = sorted({row.source_id for row in summary.rows if row.source_id != "unknown"})
    if not station_ids:
        raise ValueError(f"No station identifiers found in {path.name}")

    totals = {
        "rows": len(summary.rows),
        "upserted": 0,
        "skipped_invalid_time": 0,
        "skipped_duplicates": summary.counts.get("duplicate", 0),
        "skipped_existing": 0,
    }
    for source_id in station_ids:
        station = ensure_station(session, source_id)
        station_rows = [row for row in summary.rows if row.source_id == source_id]
        valid_time_rows = [row for row in station_rows if row.observed_at is not None]
        totals["skipped_invalid_time"] += len(station_rows) - len(valid_time_rows)
        upserted, existing = upsert_observations(
            session,
            station,
            valid_time_rows,
            processing_run.id,
            unit=station.unit_declared or MONICA_PM10_UNIT,
        )
        totals["upserted"] += upserted
        totals["skipped_existing"] += existing

    return {
        "file": path.name,
        "sha256": file_sha256(path),
        "quality_counts": summary.counts,
        "duplicate_keys": len(summary.duplicate_keys),
        **totals,
    }


def import_files(engine: Engine, folder: Path, files: list[str]) -> list[dict[str, object]]:
    """Import all files atomically; keep the run audit in a separate transaction."""
    started = datetime.now(UTC)
    run_id = uuid4()
    with Session(engine) as session, session.begin():
        run = ProcessingRun(
            id=run_id,
            kind="monica_pm10_import",
            status="running",
            git_commit=None,
            environment_version="0.1.0",
            parameters={
                "input_dir": str(folder),
                "files": files,
                "analysis_enabled": False,
                "unit_declared": MONICA_PM10_UNIT,
                "unit_source": MONICA_PM10_UNIT_SOURCE,
                "timezone_declared": None,
                "notes": (
                    "PM10 import only; unit declared from the catalog report; "
                    "timezone and coordinates still pending; not for LST calibration"
                ),
            },
            started_at=started,
            notes="analysis_enabled remains false while MONICA metadata is pending",
        )
        session.add(run)
    results: list[dict[str, object]] = []
    try:
        with Session(engine) as session, session.begin():
            run = session.get(ProcessingRun, run_id)
            assert run is not None
            for name in files:
                path = folder / name
                if not path.is_file():
                    raise FileNotFoundError(path)
                results.append(import_file(session, path, run))
            run.status = "completed"
            run.finished_at = datetime.now(UTC)
            run.parameters = {**(run.parameters or {}), "results": results}
    except Exception as error:
        # The data transaction has already rolled back, even for a failed SQL flush.
        with Session(engine) as session, session.begin():
            run = session.get(ProcessingRun, run_id)
            assert run is not None
            run.status = "failed"
            run.finished_at = datetime.now(UTC)
            run.parameters = {**(run.parameters or {}), "error_type": type(error).__name__}
        raise
    return results


def main() -> None:
    parser = argparse.ArgumentParser(description="Import MONICA PM10 CSV files into PostGIS")
    parser.add_argument(
        "--input-dir",
        type=Path,
        default=Path("data/raw/gamc/monica"),
        help="Directory containing verified MONICA CSV files",
    )
    parser.add_argument("--files", nargs="+", default=list(DEFAULT_FILES))
    args = parser.parse_args()
    folder: Path = args.input_dir
    if not folder.is_dir():
        raise SystemExit(f"Input directory not found: {folder}")
    results = import_files(get_engine(), folder, args.files)

    for entry in results:
        print(
            f"{entry['file']}: rows={entry['rows']} upserted={entry['upserted']} "
            f"duplicates={entry['duplicate_keys']} quality={entry['quality_counts']}"
        )


if __name__ == "__main__":
    main()
