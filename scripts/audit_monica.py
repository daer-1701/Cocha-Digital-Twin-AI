"""Offline audit of local MÓNICA CSV files (Eduardo EF04/EF05).

Compares checksums to data/catalog/gamc.json when present. Does not write to
PostGIS and does not invent timezone or coordinates.
"""

from __future__ import annotations

import hashlib
import json
import sys
from datetime import UTC, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "services" / "api" / "src"))

from cocha_api.science.monica import parse_monica_csv  # noqa: E402

MONICA_DIR = ROOT / "data" / "raw" / "gamc" / "monica"
CATALOG = ROOT / "data" / "catalog" / "gamc.json"
OUTPUT = ROOT / "data" / "catalog" / "monica_audit.json"
EXPECTED = (
    "red_monica.kanata (1).csv",
    "red_monica.semapa (1).csv",
)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> None:
    if not MONICA_DIR.exists():
        raise SystemExit(
            "MÓNICA folder missing. Run: python scripts/download_gamc.py"
        )

    catalog_rows = {}
    if CATALOG.exists():
        catalog = json.loads(CATALOG.read_text(encoding="utf-8"))
        for entry in catalog.get("monica_csv_inspection", []):
            catalog_rows[entry["file"]] = entry

    files: list[dict[str, object]] = []
    for name in EXPECTED:
        path = MONICA_DIR / name
        if not path.exists():
            files.append({"file": name, "status": "missing"})
            continue
        digest = sha256(path)
        text = path.read_text(encoding="utf-8", errors="replace")
        summary = parse_monica_csv(text, source_label=name)
        counts = dict(summary.counts)
        expected = catalog_rows.get(name)
        checksum_match = None if expected is None else expected.get("sha256") == digest
        files.append(
            {
                "file": name,
                "status": "audited",
                "bytes": path.stat().st_size,
                "sha256": digest,
                "checksum_matches_catalog": checksum_match,
                "catalog_rows": expected.get("rows") if expected else None,
                "parsed_rows": len(summary.rows),
                "quality_counts": counts,
                "duplicate_keys_in_file": len(summary.duplicate_keys),
                "station_values": sorted({row.source_id for row in summary.rows if row.source_id}),
                "pm10_never_presented_as_temperature": True,
                "variable": "pm10",
            }
        )

    field_evidence = {
        "estacion": {
            "status": "known",
            "evidence": "CSV column; mapped to Parque Kanata / SEMAPA via 2021 report",
        },
        "pm10": {
            "status": "known_variable_unknown_instrument_qa",
            "evidence": "CSV column; particulate matter only; not air temperature or LST",
        },
        "fecha_medicion": {
            "status": "known_naive",
            "evidence": "CSV timestamps without offset; timezone still unknown",
        },
        "unit": {
            "status": "declared_from_report_not_csv",
            "evidence": "ug/m3 from Contaminación Atmosférica Gestión 2021 PDF",
        },
        "timezone": {"status": "unknown", "evidence": "No offset in CSV; do not label UTC"},
        "latitude_longitude_elevation": {
            "status": "unknown",
            "evidence": "Addresses only; no official coordinates in download",
        },
        "zeros_and_negatives": {
            "status": "flagged_not_interpreted",
            "evidence": "Counted and quality-flagged; no official correction policy yet",
        },
        "redistribution_license": {
            "status": "unknown",
            "evidence": "Public download URL does not confirm redistribution rights",
        },
    }

    document = {
        "task": "EF04_EF05_offline",
        "verified_on": datetime.now(UTC).isoformat(),
        "import_to_postgis": "not executed in this audit (Compose DB not required here)",
        "analysis_enabled_policy": False,
        "official_correction_policy": (
            "Pending GAMC procedure. Reimport never overwrites existing "
            "station+variable+timestamp rows; corrections need an explicit review path."
        ),
        "files": files,
        "field_evidence": field_evidence,
    }
    OUTPUT.write_text(json.dumps(document, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {OUTPUT.relative_to(ROOT).as_posix()}")
    for entry in files:
        print(
            f"{entry['file']}: status={entry['status']} "
            f"rows={entry.get('parsed_rows')} checksum_ok={entry.get('checksum_matches_catalog')}"
        )


if __name__ == "__main__":
    main()
