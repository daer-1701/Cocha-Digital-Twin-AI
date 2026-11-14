"""Apply catalog timezone/coordinates to existing MONICA stations (no reimport)."""

from __future__ import annotations

from cocha_api.db.models import Station
from cocha_api.db.session import get_engine
from cocha_api.science.monica import station_import_profile
from sqlalchemy import select
from sqlalchemy.orm import Session


def main() -> None:
    with Session(get_engine()) as session:
        for source_id in ("kanata", "semapa"):
            profile = station_import_profile(source_id)
            row = session.scalar(select(Station).where(Station.source_id == source_id))
            if row is None:
                print(f"missing station {source_id}")
                continue
            row.name = profile.name
            row.unit_declared = profile.unit_declared
            row.timezone_declared = profile.timezone_declared
            row.latitude = profile.latitude
            row.longitude = profile.longitude
            row.elevation_m = profile.elevation_m
            row.analysis_enabled = False
            row.metadata_pending = list(profile.metadata_pending)
            print(
                f"{source_id}: tz={row.timezone_declared} "
                f"lat={row.latitude} lon={row.longitude} elev={row.elevation_m}"
            )
        session.commit()
    print("station metadata synced; analysis_enabled remains false")


if __name__ == "__main__":
    main()
