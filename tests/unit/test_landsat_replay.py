"""Synthetic cache files used to check verification before raster processing."""

import hashlib
import importlib.util
import json
from pathlib import Path

import pytest
from cocha_api.science.landsat import BANDS, PILOT_BOUNDS_WGS84


def test_replay_accepts_original_cache_and_rejects_a_changed_band(tmp_path: Path):
    script = Path(__file__).resolve().parents[2] / "scripts" / "ingest_landsat.py"
    spec = importlib.util.spec_from_file_location("ingest_landsat", script)
    assert spec is not None and spec.loader is not None
    ingest = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(ingest)

    raw = tmp_path / "raw"
    scene_id = "synthetic_landsat_scene"
    folder = raw / scene_id
    folder.mkdir(parents=True)
    assets = {band: f"https://example.invalid/{band}.tif" for band in BANDS}
    item = {
        "id": scene_id,
        "properties": {
            "platform": "landsat-8",
            "landsat:correction": "L2SP",
            "datetime": "2024-07-10T14:00:00Z",
        },
        "assets": {band: {"href": url} for band, url in assets.items()},
    }
    inputs = {f"{band}.tif": band.encode() for band in BANDS}
    inputs["stac.json"] = json.dumps(item).encode()
    for name, contents in inputs.items():
        (folder / name).write_bytes(contents)
    manifest = {
        "bounds": PILOT_BOUNDS_WGS84,
        "month": 7,
        "years": [2024],
        "scenes": [
            {
                "id": scene_id,
                "assets": assets,
                "files": {
                    name: hashlib.sha256(contents).hexdigest() for name, contents in inputs.items()
                },
            }
        ],
    }
    manifest_path = tmp_path / "manifest.json"
    manifest_path.write_text(json.dumps(manifest), encoding="utf-8")

    assert ingest.replay_inputs(manifest_path, raw) == ([2024], [(item, folder)])

    (folder / "red.tif").write_bytes(b"modified")
    with pytest.raises(ValueError, match="Missing or modified cached files"):
        ingest.replay_inputs(manifest_path, raw)
