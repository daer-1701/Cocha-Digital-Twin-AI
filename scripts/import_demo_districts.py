"""Idempotent import of the synthetic demo district fixture.

Refuses to run without --i-understand-demo-only. These rectangles are not GAMC
districts. A row whose boundary_version is not demo-synthetic is left untouched.
"""

from __future__ import annotations

import argparse
from pathlib import Path
from uuid import uuid4

from cocha_api.db.models import District
from cocha_api.db.session import get_engine
from cocha_api.science.demo_districts import (
    DEMO_BOUNDARY_VERSION,
    DEMO_FIXTURE_RELATIVE,
    DemoPolygon,
    load_demo_fixture,
)
from geoalchemy2.elements import WKTElement
from sqlalchemy import select
from sqlalchemy.orm import Session


class DemoOverwriteError(RuntimeError):
    """A stored district is not a demo boundary and must not be replaced."""


def upsert_demo_districts(
    session: Session,
    polygons: list[DemoPolygon],
    *,
    source_url: str,
) -> dict[str, int]:
    inserted = 0
    updated = 0
    for polygon in polygons:
        existing = session.scalar(
            select(District).where(
                District.number == polygon.number,
                District.boundary_version == DEMO_BOUNDARY_VERSION,
            )
        )
        geometry = WKTElement(polygon.as_wkt(), srid=4326)
        if existing is None:
            session.add(
                District(
                    id=uuid4(),
                    number=polygon.number,
                    name=polygon.name,
                    source_url=source_url,
                    boundary_version=DEMO_BOUNDARY_VERSION,
                    geometry=geometry,
                )
            )
            inserted += 1
            continue
        version = str(existing.boundary_version)
        if not version.startswith("demo-synthetic"):
            raise DemoOverwriteError(
                f"Refusing to replace district {polygon.number} with boundary_version {version}"
            )
        existing.name = polygon.name
        existing.source_url = source_url
        existing.boundary_version = DEMO_BOUNDARY_VERSION
        existing.geometry = geometry
        updated += 1
    return {"inserted": inserted, "updated": updated}


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--i-understand-demo-only",
        action="store_true",
        help="Required acknowledgement that the fixture is not an official GAMC boundary",
    )
    parser.add_argument(
        "--fixture",
        type=Path,
        default=Path(DEMO_FIXTURE_RELATIVE),
        help="GeoJSON fixture path",
    )
    args = parser.parse_args(argv)
    if not args.i_understand_demo_only:
        raise SystemExit(
            "Refusing to import demo districts without --i-understand-demo-only. "
            "This fixture is not an official GAMC boundary."
        )
    polygons = load_demo_fixture(args.fixture)
    with Session(get_engine()) as session:
        counts = upsert_demo_districts(session, polygons, source_url=DEMO_FIXTURE_RELATIVE)
        session.commit()
    print(
        f"demo districts boundary_version={DEMO_BOUNDARY_VERSION} "
        f"inserted={counts['inserted']} updated={counts['updated']}"
    )


if __name__ == "__main__":
    main()
