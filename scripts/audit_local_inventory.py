"""Build a local on-disk inventory for Eduardo EF01 (no invented remote assets)."""

from __future__ import annotations

import hashlib
import json
from datetime import UTC, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCAN_ROOTS = (
    ROOT / "data" / "catalog",
    ROOT / "data" / "fixtures",
    ROOT / "data" / "raw",
    ROOT / "data" / "processed",
    ROOT / "data" / "models",
)
OUTPUT = ROOT / "data" / "catalog" / "inventory.json"
IGNORE_NAMES = {".gitkeep"}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def classify(path: Path) -> dict[str, str]:
    relative = path.relative_to(ROOT).as_posix()
    if "demo_districts" in path.name:
        return {
            "nature": "synthetic_demo",
            "license_status": "project fixture; not redistributable as official GAMC",
            "availability": "present",
        }
    if relative.startswith("data/catalog/"):
        return {
            "nature": "sanitized_catalog",
            "license_status": "project documentation; no secrets",
            "availability": "present",
        }
    if relative.startswith("data/raw/gamc/monica/"):
        return {
            "nature": "municipal_observation_raw",
            "license_status": "redistribution not confirmed; keep outside Git",
            "availability": "present",
        }
    if relative.startswith("data/raw/landsat") or relative.startswith("data/processed/"):
        return {
            "nature": "satellite_processed_or_raw",
            "license_status": "Landsat open data when present; USGS/NASA attribution",
            "availability": "present",
        }
    return {
        "nature": "local_artifact",
        "license_status": "review before redistribution",
        "availability": "present",
    }


def expected_absent() -> list[dict[str, str]]:
    return [
        {
            "path": "data/raw/gamc/districts/official.*",
            "nature": "official_district_vector",
            "availability": "absent",
            "blocker": "Authorized GAMC GeoJSON/GPKG/Shapefile for 15 districts not obtained",
            "license_status": "unknown",
        },
        {
            "path": "data/raw/gamc/socioenvironmental/*",
            "nature": "socioenvironmental_layers",
            "availability": "absent",
            "blocker": "Authorized greenspace/population/transport vectors not downloaded",
            "license_status": "unknown",
        },
        {
            "path": "data/raw/landsat-pilot/*",
            "nature": "landsat_pilot_cache",
            "availability": "absent_in_this_clone",
            "blocker": "Run scripts/ingest_landsat.py when acquisition is authorized",
            "license_status": "Landsat open data",
        },
        {
            "path": "data/processed/explorer.json",
            "nature": "landsat_explorer_snapshot",
            "availability": "absent_in_this_clone",
            "blocker": "Depends on Landsat ingest",
            "license_status": "derived from Landsat open data",
        },
        {
            "path": "data/backups/*.dump",
            "nature": "database_archive",
            "availability": "absent",
            "blocker": "Compose PostGIS not running in this session; EF10 trial pending",
            "license_status": "may contain restricted municipal data",
        },
    ]


def main() -> None:
    files: list[dict[str, object]] = []
    for root in SCAN_ROOTS:
        if not root.exists():
            continue
        for path in sorted(root.rglob("*")):
            if not path.is_file() or path.name in IGNORE_NAMES:
                continue
            relative = path.relative_to(ROOT).as_posix()
            meta = classify(path)
            files.append(
                {
                    "path": relative,
                    "bytes": path.stat().st_size,
                    "sha256": sha256(path),
                    "modified_utc": datetime.fromtimestamp(path.stat().st_mtime, UTC).isoformat(),
                    **meta,
                }
            )

    document = {
        "task": "EF01",
        "verified_on": datetime.now(UTC).date().isoformat(),
        "clone_root": str(ROOT),
        "policy": (
            "Inventory records only files present on this machine. Missing "
            "official assets are listed as absent; nothing is invented."
        ),
        "files_present": files,
        "files_absent_or_blocked": expected_absent(),
        "permissions_summary": {
            "gamc_wms_key_in_process_env": "GAMC_WMS_API_KEY" in __import__("os").environ,
            "dotenv_present": (ROOT / ".env").exists(),
            "note": "Secret values are never recorded in this inventory",
        },
        "coverage_notes": [
            "MÓNICA CSV download is local and checksummed when present under data/raw/gamc/monica/",
            "Demo districts fixture is synthetic and must not be labeled official",
            "Official 15-district vector remains the critical blocker for EF02/EF03",
        ],
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(document, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {OUTPUT.relative_to(ROOT).as_posix()} with {len(files)} present files")


if __name__ == "__main__":
    main()
