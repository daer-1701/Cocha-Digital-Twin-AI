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
from uuid import uuid4

from cocha_api.db.models import Observation, ProcessingRun, Station
from cocha_api.db.session import get_engine
from cocha_api.science.gamc_catalog import MONICA_PM10_UNIT, MONICA_PM10_UNIT_SOURCE
from cocha_api.science.monica import MonicaRow, parse_monica_csv, station_import_profile
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
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
    processing_run_id,
    *,
    unit: str,
) -> tuple[int, int]:
    inserted = 0
    updated = 0
    for row in rows:
        if row.observed_at is None:
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
            .on_conflict_do_update(
                constraint="observations_station_variable_time_key",
                set_={
                    "processing_run_id": processing_run_id,
                    "observed_at_raw": row.observed_at_raw,
                    "value": row.value,
                    "quality_flag": row.quality_flag,
                    "unit": unit,
                },
            )
            .returning(Observation.id, Observation.created_at)
        )
        result = session.execute(statement).one()
        # Heuristic: brand-new rows have created_at near now; conflict updates keep id.
        # Count via xmax-style is unavailable here; treat returning as upserted.
        inserted += 1
        _ = result, updated
    return inserted, updated


def import_file(session: Session, path: Path, processing_run: ProcessingRun) -> dict:
    text = path.read_text(encoding="utf-8")
    summary = parse_monica_csv(text, source_label=path.name)
    station_ids = sorted({row.source_id for row in summary.rows if row.source_id != "unknown"})
    if not station_ids:
        raise ValueError(f"No station identifiers found in {path.name}")

    totals = {"rows": len(summary.rows), "upserted": 0, "skipped_invalid_time": 0}
    for source_id in station_ids:
        station = ensure_station(session, source_id)
        station_rows = [row for row in summary.rows if row.source_id == source_id]
        valid_time_rows = [row for row in station_rows if row.observed_at is not None]
        totals["skipped_invalid_time"] += len(station_rows) - len(valid_time_rows)
        upserted, _ = upsert_observations(
            session,
            station,
            valid_time_rows,
            processing_run.id,
            unit=station.unit_declared or MONICA_PM10_UNIT,
        )
        totals["upserted"] += upserted

    return {
        "file": path.name,
        "sha256": file_sha256(path),
        "quality_counts": summary.counts,
        "duplicate_keys": len(summary.duplicate_keys),
        **totals,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Import MONICA PM10 CSV files into PostGIS")
    parser.add_argument(
        "--input-dir",
        type=Path,
        default=Path("data/raw/gamc/monica"),
        help="Directory containing verified MONICA CSV files",
    )
    parser.add_argument(
        "--files",
        nargs="*",
        default=list(DEFAULT_FILES),
        help="CSV filenames to import",
    )
    args = parser.parse_args()
    folder: Path = args.input_dir
    if not folder.is_dir():
        raise SystemExit(f"Input directory not found: {folder}")

    started = datetime.now(UTC)
    with Session(get_engine()) as session:
        run = ProcessingRun(
            id=uuid4(),
            kind="monica_pm10_import",
            status="running",
            git_commit=None,
            environment_version="0.1.0",
            parameters={
                "input_dir": str(folder),
                "files": list(args.files),
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
        session.flush()

        results = []
        try:
            for name in args.files:
                path = folder / name
                if not path.is_file():
                    raise FileNotFoundError(path)
                results.append(import_file(session, path, run))
            run.status = "completed"
            run.finished_at = datetime.now(UTC)
            run.parameters = {**(run.parameters or {}), "results": results}
            session.commit()
        except Exception:
            run.status = "failed"
            run.finished_at = datetime.now(UTC)
            session.commit()
            raise

    for entry in results:
        print(
            f"{entry['file']}: rows={entry['rows']} upserted={entry['upserted']} "
            f"duplicates={entry['duplicate_keys']} quality={entry['quality_counts']}"
        )


if __name__ == "__main__":
    main()
