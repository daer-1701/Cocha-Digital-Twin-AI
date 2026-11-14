"""Local processing step without Celery or Redis.

Validates a MONICA CSV QA summary. Persists a processing_run when the database
answers. If the database is unavailable, the QA summary still runs and is not
stored. PM10 is not air temperature and analysis stays disabled.
"""

from __future__ import annotations

import argparse
import json
from datetime import UTC, datetime, timedelta
from pathlib import Path
from uuid import uuid4

from cocha_api.core.config import get_settings
from cocha_api.db.models import ProcessingRun
from cocha_api.db.session import get_engine
from cocha_api.jobs import file_sha256, finish_run, idempotency_key, start_run
from cocha_api.science.gamc_catalog import MONICA_PM10_UNIT
from cocha_api.science.monica import parse_monica_csv
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

KIND = "offline_monica_qa"
DEFAULT_FILES = (
    "red_monica.kanata (1).csv",
    "red_monica.semapa (1).csv",
)


def summarize_csvs(paths: list[Path]) -> dict:
    files = []
    for path in paths:
        summary = parse_monica_csv(path.read_text(encoding="utf-8"), source_label=path.name)
        files.append(
            {
                "file": path.name,
                "rows": len(summary.rows),
                "quality_counts": summary.counts,
                "duplicate_keys": len(summary.duplicate_keys),
                "unit_declared": MONICA_PM10_UNIT,
                "analysis_enabled": False,
                "pm10_is_not_air_temperature": True,
            }
        )
    return {
        "files": files,
        "note": "Dry QA summary only. Not a physical analysis and not an LST calibration.",
    }


def run_offline(paths: list[Path], session: Session | None) -> dict:
    run = None
    if session is not None:
        run = ProcessingRun(
            id=uuid4(),
            kind="offline_monica_qa",
            status="running",
            git_commit=None,
            environment_version="0.1.0",
            parameters={"dry": True, "analysis_enabled": False},
            started_at=datetime.now(UTC),
            notes="Dry MONICA CSV QA. PM10 is not air temperature.",
        )
        session.add(run)
        session.flush()
    try:
        qa = summarize_csvs(paths)
    except Exception:
        if session is not None and run is not None:
            run.status = "failed"
            run.finished_at = datetime.now(UTC)
            run.notes = "QA step failed"
            session.commit()
        raise
    if session is None or run is None:
        return {"persisted": False, "run_id": None, "status": "completed_local_only", "qa": qa}
    run.status = "completed"
    run.finished_at = datetime.now(UTC)
    run.parameters = {"dry": True, "analysis_enabled": False, "qa": qa}
    session.commit()
    return {"persisted": True, "run_id": str(run.id), "status": run.status, "qa": qa}


def run_offline_idempotent(paths: list[Path], session: Session) -> dict:
    """Same QA step keyed by input checksums: completed inputs are not re-run."""

    settings = get_settings()
    key = idempotency_key(KIND, *sorted(file_sha256(path) for path in paths))
    outcome = start_run(
        session,
        kind=KIND,
        key=key,
        parameters={"dry": True, "analysis_enabled": False},
        environment_version="0.1.0",
        notes="Dry MONICA CSV QA. PM10 is not air temperature.",
        max_attempts=settings.job_max_attempts,
        stale_after=timedelta(seconds=settings.job_stale_after_seconds),
    )
    if not outcome.should_execute:
        return {
            "persisted": True,
            "run_id": str(outcome.run_id),
            "status": outcome.decision,
            "attempt": outcome.attempt,
        }
    try:
        qa = summarize_csvs(paths)
    except (OSError, UnicodeError, ValueError):
        finish_run(session, outcome.run_id, status="failed", error_code="qa_step_failed")
        raise
    finish_run(
        session,
        outcome.run_id,
        status="completed",
        parameters={"dry": True, "analysis_enabled": False, "qa": qa},
    )
    return {
        "persisted": True,
        "run_id": str(outcome.run_id),
        "status": "completed",
        "attempt": outcome.attempt,
        "qa": qa,
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--no-db", action="store_true", help="QA only; do not open a database")
    parser.add_argument("--input-dir", type=Path, default=Path("data/raw/gamc/monica"))
    parser.add_argument("--files", nargs="*", default=list(DEFAULT_FILES))
    args = parser.parse_args(argv)
    paths = [args.input_dir / name for name in args.files]
    missing = [str(path) for path in paths if not path.is_file()]
    if missing:
        print(json.dumps({"status": "skipped_missing_input", "missing": missing}))
        return 2
    if args.no_db:
        try:
            payload = run_offline(paths, None)
        except (OSError, UnicodeError, ValueError):
            print(json.dumps({"status": "failed", "reason": "qa_step_failed"}))
            return 1
        print(json.dumps(payload))
        return 0
    try:
        with Session(get_engine()) as session:
            session.connection()
            payload = run_offline_idempotent(paths, session)
    except SQLAlchemyError:
        payload = run_offline(paths, None)
        payload["database"] = "unavailable"
        print(json.dumps(payload))
        return 0
    except (OSError, UnicodeError, ValueError):
        print(json.dumps({"status": "failed", "reason": "qa_step_failed"}))
        return 1
    print(json.dumps(payload))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
