"""Import an authorized GAMC district GeoJSON into PostGIS (EF03).

Refuses demo fixtures and non-official boundary versions. Each boundary_version
is stored alongside demo rows and earlier versions; nothing of another version
is overwritten. Rows of the same version are updated only with
--replace-same-version.
"""

from __future__ import annotations

import argparse
from pathlib import Path
from uuid import uuid4

from cocha_api.db.models import District
from cocha_api.db.session import get_engine
from cocha_api.science.official_districts import (
    DEMO_BOUNDARY_PREFIX,
    OfficialDistrictError,
    load_official_geojson,
)
from geoalchemy2.elements import WKTElement
from sqlalchemy import select
from sqlalchemy.orm import Session


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("geojson", type=Path)
    parser.add_argument("--boundary-version", required=True)
    parser.add_argument("--source-url", required=True)
    parser.add_argument(
        "--i-confirm-authorized-gamc-vector",
        action="store_true",
        help="Required acknowledgement that the file is GAMC-authorized",
    )
    parser.add_argument(
        "--replace-same-version",
        action="store_true",
        help="Update rows that already use this exact boundary_version",
    )
    args = parser.parse_args(argv)

    if not args.i_confirm_authorized_gamc_vector:
        raise SystemExit(
            "Refusing import without --i-confirm-authorized-gamc-vector. "
            "Do not import third-party or demo layers as official districts."
        )
    if args.boundary_version.startswith(DEMO_BOUNDARY_PREFIX):
        raise SystemExit("Demo boundary versions cannot be imported as official")

    try:
        polygons = load_official_geojson(
            args.geojson,
            boundary_version=args.boundary_version,
            source_url=args.source_url,
        )
    except OfficialDistrictError as error:
        raise SystemExit(f"Validation failed: {error}") from None

    inserted = 0
    updated = 0
    with Session(get_engine()) as session:
        for polygon in polygons:
            # Unique key is (boundary_version, number): demo rows and other versions coexist.
            existing = session.scalar(
                select(District).where(
                    District.boundary_version == polygon.boundary_version,
                    District.number == polygon.number,
                )
            )
            geometry = WKTElement(polygon.as_wkt(), srid=4326)
            if existing is None:
                session.add(
                    District(
                        id=uuid4(),
                        number=polygon.number,
                        name=polygon.name,
                        source_url=polygon.source_url,
                        boundary_version=polygon.boundary_version,
                        geometry=geometry,
                    )
                )
                inserted += 1
                continue
            if not args.replace_same_version:
                continue
            existing.name = polygon.name
            existing.source_url = polygon.source_url
            existing.geometry = geometry
            updated += 1
        session.commit()

    print(
        f"official districts boundary_version={args.boundary_version} "
        f"inserted={inserted} updated={updated}"
    )
    print("Run PostGIS ST_IsValid / overlap checks before enabling zonal statistics")


if __name__ == "__main__":
    main()
