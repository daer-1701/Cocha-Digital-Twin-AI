"""Register a read-only processing_run row for offline batch provenance (A13).

Does not start workers or call external APIs. Requires DATABASE_URL / Compose DB.
"""

from __future__ import annotations

import argparse
import json
from datetime import UTC, datetime
from uuid import uuid4

from cocha_api.db.models import ProcessingRun
from cocha_api.db.session import get_engine
from sqlalchemy.orm import Session


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--kind", required=True, help="e.g. landsat_pilot, monica_import")
    parser.add_argument("--status", default="recorded", help="Run status label")
    parser.add_argument("--git-commit", default=None)
    parser.add_argument("--notes", default=None)
    parser.add_argument(
        "--parameters-json",
        default="{}",
        help="JSON object of non-secret parameters",
    )
    args = parser.parse_args()
    parameters = json.loads(args.parameters_json)
    if not isinstance(parameters, dict):
        raise SystemExit("parameters-json must be a JSON object")

    run = ProcessingRun(
        id=uuid4(),
        kind=args.kind,
        status=args.status,
        git_commit=args.git_commit,
        environment_version=None,
        parameters=parameters,
        started_at=datetime.now(UTC),
        finished_at=datetime.now(UTC),
        notes=args.notes,
    )
    with Session(get_engine()) as session:
        session.add(run)
        session.commit()
        print(run.id)


if __name__ == "__main__":
    main()
