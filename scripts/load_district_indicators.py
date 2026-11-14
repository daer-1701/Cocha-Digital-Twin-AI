"""Load zonal statistics (JSON Lines) into district_indicators as drafts.

Nothing becomes public here: rows stay 'draft' until scripts/publish_results.py
accepts them after scientific review. Demo boundary versions are refused.
Reloading the same file is idempotent (same key, ON CONFLICT DO NOTHING).
Validate with --dry-run first; it does not open a database.
"""

from __future__ import annotations

import argparse
import json
import math
import sys
from datetime import date, timedelta
from pathlib import Path
from typing import Any

from cocha_api.core.config import get_settings
from cocha_api.db.models import District, DistrictIndicator
from cocha_api.db.session import get_engine
from cocha_api.jobs import file_sha256, finish_run, idempotency_key, start_run
from cocha_api.science.demo_districts import DEMO_BOUNDARY_VERSION
from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator, model_validator
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

KIND = "district_indicator_load"


class SourceProvenance(BaseModel):
    model_config = ConfigDict(extra="allow")

    source_url: str = Field(min_length=1)
    product: str = Field(min_length=1)
    product_version: str = Field(min_length=1)
    qa_mask: str = Field(min_length=1)
    resolution_m: float = Field(gt=0)
    crs: str = Field(min_length=1)


class IndicatorRecord(BaseModel):
    model_config = ConfigDict(extra="forbid")

    district_number: int = Field(ge=1, le=15)
    boundary_version: str = Field(min_length=1, max_length=100)
    variable: str = Field(min_length=1, max_length=64)
    statistic: str = Field(min_length=1, max_length=64)
    period_start: date
    period_end: date
    value: float | None
    units: str = Field(min_length=1, max_length=64)
    valid_fraction: float | None = Field(default=None, ge=0, le=1)
    n: int | None = Field(default=None, ge=0)
    provenance: SourceProvenance

    @field_validator("value")
    @classmethod
    def finite(cls, value: float | None) -> float | None:
        if value is not None and not math.isfinite(value):
            raise ValueError("value must be finite or null; missing data is null, never zero")
        return value

    @field_validator("boundary_version")
    @classmethod
    def not_demo(cls, value: str) -> str:
        if value.startswith("demo-synthetic"):
            raise ValueError("demo rectangles are not official districts")
        return value

    @model_validator(mode="after")
    def ordered_period(self) -> IndicatorRecord:
        if self.period_start > self.period_end:
            raise ValueError("period_start must not exceed period_end")
        return self


def read_records(path: Path) -> tuple[list[IndicatorRecord], list[dict[str, Any]]]:
    records: list[IndicatorRecord] = []
    errors: list[dict[str, Any]] = []
    with path.open(encoding="utf-8") as handle:
        for line_number, line in enumerate(handle, start=1):
            if not line.strip():
                continue
            try:
                records.append(IndicatorRecord.model_validate_json(line))
            except ValidationError as error:
                errors.append({"line": line_number, "errors": error.errors(include_input=False)})
    return records, errors


def load(session: Session, records: list[IndicatorRecord], run_id) -> dict[str, int]:
    versions = {record.boundary_version for record in records}
    districts = {
        (row.boundary_version, row.number): row.id
        for row in session.scalars(select(District).where(District.boundary_version.in_(versions)))
    }
    missing = sorted(
        {
            f"{r.boundary_version}#{r.district_number}"
            for r in records
            if (r.boundary_version, r.district_number) not in districts
        }
    )
    if missing:
        raise LookupError(f"districts not imported: {', '.join(missing[:10])}")
    if DEMO_BOUNDARY_VERSION in versions:
        raise ValueError("demo boundary version refused")
    inserted = 0
    for record in records:
        statement = (
            insert(DistrictIndicator)
            .values(
                district_id=districts[(record.boundary_version, record.district_number)],
                boundary_version=record.boundary_version,
                variable=record.variable,
                statistic=record.statistic,
                period_start=record.period_start,
                period_end=record.period_end,
                value=record.value,
                units=record.units,
                valid_fraction=record.valid_fraction,
                n=record.n,
                processing_run_id=run_id,
                provenance=record.provenance.model_dump(),
                publication_status="draft",
            )
            .on_conflict_do_nothing(constraint="district_indicators_identity_key")
            .returning(DistrictIndicator.id)
        )
        if session.execute(statement).first() is not None:
            inserted += 1
    return {"received": len(records), "inserted": inserted, "skipped": len(records) - inserted}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path, help="JSON Lines file delivered by processing")
    parser.add_argument("--dry-run", action="store_true", help="Validate only; no database")
    args = parser.parse_args(argv)
    if not args.input.is_file():
        print(json.dumps({"status": "skipped_missing_input"}))
        return 2
    records, errors = read_records(args.input)
    if errors:
        print(json.dumps({"status": "invalid", "errors": errors[:50]}, default=str))
        return 1
    if args.dry_run:
        print(json.dumps({"status": "valid", "records": len(records)}))
        return 0
    settings = get_settings()
    with Session(get_engine()) as session:
        outcome = start_run(
            session,
            kind=KIND,
            key=idempotency_key(KIND, file_sha256(args.input)),
            parameters={"input": args.input.name, "records": len(records)},
            max_attempts=settings.job_max_attempts,
            stale_after=timedelta(seconds=settings.job_stale_after_seconds),
        )
        if not outcome.should_execute:
            print(json.dumps({"status": outcome.decision, "run_id": str(outcome.run_id)}))
            return 0
        try:
            counts = load(session, records, outcome.run_id)
            session.commit()
        except (LookupError, ValueError) as error:
            session.rollback()
            finish_run(session, outcome.run_id, status="failed", error_code="invalid_reference")
            print(json.dumps({"status": "failed", "reason": str(error)}))
            return 1
        except Exception:
            session.rollback()
            finish_run(session, outcome.run_id, status="failed", error_code="load_failed")
            raise
        finish_run(
            session,
            outcome.run_id,
            status="completed",
            parameters={"input": args.input.name, **counts},
        )
    print(json.dumps({"status": "completed", "run_id": str(outcome.run_id), **counts}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
