"""Bounded real-data pilot. Download only five small COG windows per selected scene."""

import argparse
import json
import subprocess
from datetime import UTC, datetime
from pathlib import Path

import httpx
from cocha_api.science.landsat import (
    PILOT_BOUNDS_WGS84,
    build_pilot_snapshot,
    get_json,
    read_scene,
    scene_manifest,
    select_scene_for_year,
    stac_search_params,
    stac_search_url,
    validate_bounded_years,
)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--years", nargs="+", type=int, default=[2022, 2023, 2024])
    args = parser.parse_args()
    try:
        years = validate_bounded_years(args.years)
    except ValueError as exc:
        parser.error(str(exc))
    raw = Path("data/raw/landsat-pilot")
    raw.mkdir(parents=True, exist_ok=True)
    scenes, manifests = [], []
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
            print(f"Processed {item['id']}: {scenes[-1].valid_fraction:.1%} valid pixels")
    snapshot = build_pilot_snapshot(scenes, generated_at=datetime.now(UTC))
    output = Path("data/processed")
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
    print("Published data/processed/explorer.json and landsat-manifest.json")


if __name__ == "__main__":
    main()
