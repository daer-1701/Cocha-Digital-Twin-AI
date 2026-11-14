"""Accept or withdraw stored results of one processing run after scientific review.

Dry run by default: prints how many rows would change. --apply writes in one
transaction. Database constraints refuse accepted models without version,
checksum, uncertainty and domain of use. Acceptance is a team decision
recorded with --accepted-by; this script does not evaluate science.
"""

from __future__ import annotations

import argparse
import json
from datetime import UTC, datetime
from uuid import UUID

from cocha_api.db.models import DistrictIndicator, ModelRun, ScenarioRun, TrendResult
from cocha_api.db.session import get_engine
from sqlalchemy import func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

TABLES = {
    "district_indicators": DistrictIndicator,
    "trend_results": TrendResult,
    "model_runs": ModelRun,
    "scenario_runs": ScenarioRun,
}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("table", choices=sorted(TABLES))
    parser.add_argument("--processing-run-id", type=UUID, required=True)
    parser.add_argument("--accepted-by", required=True, help="Reviewer name or role label")
    parser.add_argument("--withdraw", action="store_true", help="Mark rows withdrawn instead")
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args(argv)
    model = TABLES[args.table]
    target = "withdrawn" if args.withdraw else "accepted"
    source = ("accepted",) if args.withdraw else ("draft",)
    where = (
        model.processing_run_id == args.processing_run_id,
        model.publication_status.in_(source),
    )
    with Session(get_engine()) as session:
        count = session.scalar(select(func.count()).select_from(model).where(*where)) or 0
        if not args.apply:
            print(json.dumps({"applied": False, "table": args.table, "rows": count}))
            return 0
        values = {"publication_status": target}
        if not args.withdraw:
            values |= {"accepted_by": args.accepted_by, "accepted_at": datetime.now(UTC)}
        try:
            changed = session.execute(update(model).where(*where).values(**values)).rowcount
            session.commit()
        except IntegrityError:
            session.rollback()
            print(
                json.dumps(
                    {"applied": False, "reason": "acceptance_constraint_failed", "rows": count}
                )
            )
            return 1
    print(json.dumps({"applied": True, "table": args.table, "rows": changed, "status": target}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
