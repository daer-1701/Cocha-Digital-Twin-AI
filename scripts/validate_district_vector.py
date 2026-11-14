"""Validate an authorized GeoJSON district vector before PostGIS import (EF03).

Usage:
  uv run --no-sync python scripts/validate_district_vector.py path/to/districts.geojson \
    --boundary-version gamc-official-YYYYMMDD --source-url https://...
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "services" / "api" / "src"))

from cocha_api.science.official_districts import (  # noqa: E402
    OfficialDistrictError,
    load_official_geojson,
    validation_report,
)


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("geojson", type=Path)
    parser.add_argument("--boundary-version", required=True)
    parser.add_argument("--source-url", required=True)
    parser.add_argument(
        "--report",
        type=Path,
        default=ROOT / "data" / "catalog" / "district_vector_validation.json",
    )
    args = parser.parse_args(argv)

    if not args.geojson.exists():
        raise SystemExit(
            f"Vector file not found: {args.geojson}. EF02 must deliver an authorized file first."
        )
    try:
        polygons = load_official_geojson(
            args.geojson,
            boundary_version=args.boundary_version,
            source_url=args.source_url,
        )
    except OfficialDistrictError as error:
        raise SystemExit(f"Validation failed: {error}") from None

    report = validation_report(polygons)
    report["input_path"] = str(args.geojson.resolve())
    report["status"] = "structurally_valid"
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(f"Structural validation OK for {len(polygons)} districts")
    print(f"Report: {args.report}")
    print("Next: import with scripts/import_official_districts.py on an isolated DB")


if __name__ == "__main__":
    main()
