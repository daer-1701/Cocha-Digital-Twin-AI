"""List processing runs whose heartbeat expired; mark them interrupted with --apply.

Dry run by default. Interrupted runs are retried by the next worker invocation
with the same idempotency key while attempts remain. Never run against a
shared database without the operator's agreement.
"""

from __future__ import annotations

import argparse
import json
from datetime import timedelta

from cocha_api.core.config import get_settings
from cocha_api.db.session import get_engine
from cocha_api.jobs import recover_stale
from sqlalchemy.orm import Session


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="Mark stale runs as interrupted")
    parser.add_argument(
        "--stale-after-seconds",
        type=int,
        default=get_settings().job_stale_after_seconds,
    )
    args = parser.parse_args(argv)
    if args.stale_after_seconds < 60:
        raise SystemExit("stale-after-seconds must be at least 60")
    with Session(get_engine()) as session:
        ids = recover_stale(
            session, stale_after=timedelta(seconds=args.stale_after_seconds), apply=args.apply
        )
    print(
        json.dumps(
            {"applied": args.apply, "stale_runs": [str(item) for item in ids], "count": len(ids)}
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
