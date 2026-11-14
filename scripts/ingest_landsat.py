"""Bounded real-data pilot. Download only five small COG windows per selected scene."""

import argparse
import json
import re
import subprocess
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import httpx
from cocha_api.science.landsat import (
    BANDS,
    PILOT_BOUNDS_WGS84,
    build_pilot_snapshot,
    file_sha256_map,
    get_json,
    read_scene,
    scene_manifest,
    select_scene_for_year,
    stac_search_params,
    stac_search_url,
    validate_bounded_years,
)


def replay_inputs(
    manifest_path: Path, raw: Path
) -> tuple[list[int], list[tuple[dict[str, Any], Path]]]:
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    if (
        not isinstance(manifest, dict)
        or manifest.get("bounds") != list(PILOT_BOUNDS_WGS84)
        or manifest.get("month") != 7
    ):
        raise ValueError("Manifest must describe the July Landsat pilot window")
    years = manifest.get("years")
    entries = manifest.get("scenes")
    if (
        not isinstance(years, list)
        or any(not isinstance(year, int) for year in years)
        or validate_bounded_years(years) != years
        or not isinstance(entries, list)
        or len(entries) != len(years)
    ):
        raise ValueError("Manifest must contain one scene for each bounded pilot year")

    inputs = []
    required_files = {"stac.json", *(f"{band}.tif" for band in BANDS)}
    for year, entry in zip(years, entries, strict=True):
        scene_id = entry.get("id") if isinstance(entry, dict) else None
        if not isinstance(scene_id, str) or not re.fullmatch(r"[A-Za-z0-9_-]+", scene_id):
            raise ValueError("Manifest contains an invalid Landsat 8/9 scene ID")
        folder = raw / scene_id
        expected = entry.get("files")
        if (
            not folder.is_dir()
            or not isinstance(expected, dict)
            or required_files - expected.keys()
        ):
            raise ValueError(f"Incomplete cached inputs for {scene_id}")
        actual = file_sha256_map(folder)
        if any(actual.get(name) != expected[name] for name in required_files):
            raise ValueError(f"Missing or modified cached files for {scene_id}")
        item = json.loads((folder / "stac.json").read_text(encoding="utf-8"))
        if not isinstance(item, dict) or item.get("id") != scene_id:
            raise ValueError(f"Cached STAC ID does not match {scene_id}")
        select_scene_for_year([item], year)
        if entry.get("assets") != {band: item["assets"][band]["href"] for band in BANDS}:
            raise ValueError(f"Cached STAC assets do not match the manifest for {scene_id}")
        acquired = datetime.fromisoformat(item["properties"]["datetime"])
        if (acquired.year, acquired.month) != (year, 7) or acquired.utcoffset() is None:
            raise ValueError(f"Cached STAC date does not match July {year}")
        inputs.append((item, folder))
    return years, inputs


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--years", nargs="+", type=int)
    mode.add_argument(
        "--replay-manifest", type=Path, help="Process only verified local raster windows"
    )
    parser.add_argument(
        "--district-version",
        help="With --replay-manifest, persist indicators for this imported official version",
    )
    args = parser.parse_args()
    if args.district_version and args.replay_manifest is None:
        parser.error("--district-version requires --replay-manifest")
    raw = Path("data/raw/landsat-pilot")
    scenes, manifests = [], []
    output = Path("data/processed")
    if args.replay_manifest is not None:
        try:
            years, inputs = replay_inputs(args.replay_manifest, raw)
        except (OSError, ValueError, KeyError, TypeError) as exc:
            parser.error(f"Cannot replay manifest: {exc}")
        if args.district_version:
            from cocha_api.db.session import get_engine
            from cocha_api.science.district_batch import persist_district_batch
            from sqlalchemy.orm import Session

            commit = subprocess.check_output(["git", "rev-parse", "HEAD"], text=True).strip()
            with Session(get_engine()) as session, session.begin():
                count = persist_district_batch(
                    session, inputs, boundary_version=args.district_version, commit=commit
                )
            print(f"Inserted {count} district indicators")
            return
        output /= "landsat-replay"
        for item, folder in inputs:
            scenes.append(read_scene(None, item, folder))
            manifests.append(scene_manifest(folder, item))
    else:
        try:
            years = validate_bounded_years(args.years or [2022, 2023, 2024])
        except ValueError as exc:
            parser.error(str(exc))
        raw.mkdir(parents=True, exist_ok=True)
        with httpx.Client(timeout=40, follow_redirects=True) as client:
            for year in years:
                result = get_json(client, stac_search_url(), stac_search_params(year))
                item = select_scene_for_year(result.get("features", []), year)
                folder = raw / item["id"]
                folder.mkdir(exist_ok=True)
                metadata = folder / "stac.json"
                metadata.write_text(json.dumps(item, indent=2) + "\n", encoding="utf-8")
                scenes.append(read_scene(client, item, folder))
                manifests.append(scene_manifest(folder, item))
    for scene in scenes:
        print(f"Processed {scene.id}: {scene.valid_fraction:.1%} valid pixels")
    snapshot = build_pilot_snapshot(scenes, generated_at=datetime.now(UTC))
    output.mkdir(parents=True, exist_ok=True)
    commit = subprocess.run(
        ["git", "rev-parse", "HEAD"], capture_output=True, text=True, check=True
    ).stdout.strip()
    (output / "landsat-manifest.json").write_text(
        json.dumps(
            {
                "generated_at": snapshot.generated_at.isoformat(),
                "commit": commit,
                "bounds": PILOT_BOUNDS_WGS84,
                "years": years,
                "month": 7,
                "scenes": manifests,
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    temporary = output / "explorer.tmp"
    temporary.write_text(snapshot.model_dump_json(indent=2) + "\n", encoding="utf-8")
    temporary.replace(output / "explorer.json")
    print(f"Published explorer.json and landsat-manifest.json in {output}")


if __name__ == "__main__":
    main()
