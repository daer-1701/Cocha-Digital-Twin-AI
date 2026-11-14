"""Multitemporal Landsat helpers. Fixtures only; no scene downloads."""

import hashlib
from datetime import UTC, datetime
from pathlib import Path

import pytest
from cocha_api.science.landsat import (
    BANDS,
    PILOT_LIMITATIONS,
    PILOT_WINDOW_IS_NOT_A_DISTRICT,
    SceneNotFoundError,
    build_pilot_snapshot,
    clip_pixel_window,
    file_sha256_map,
    redact_url_query,
    scene_manifest,
    select_scene_for_year,
    stac_search_params,
    validate_bounded_years,
)


def test_bounded_years_are_deduped_and_rejected_outside_the_pilot():
    assert validate_bounded_years([2024, 2022, 2022]) == [2022, 2024]
    with pytest.raises(ValueError, match="2014 and 2025"):
        validate_bounded_years([2010])
    with pytest.raises(ValueError, match="at most"):
        validate_bounded_years(list(range(2014, 2021)))


def test_year_without_a_compatible_scene_fails():
    features = [
        {
            "id": "landsat-7",
            "properties": {
                "platform": "landsat-7",
                "landsat:correction": "L2SP",
                "eo:cloud_cover": 1,
            },
        }
    ]
    with pytest.raises(SceneNotFoundError, match="2024"):
        select_scene_for_year(features, 2024)
    with pytest.raises(SceneNotFoundError, match="No compatible scene"):
        select_scene_for_year([], 2023)


def test_lowest_cloud_landsat_8_or_9_scene_is_selected():
    features = [
        {
            "id": "cloudy",
            "properties": {
                "platform": "landsat-8",
                "landsat:correction": "L2SP",
                "eo:cloud_cover": 40,
            },
        },
        {
            "id": "clear",
            "properties": {
                "platform": "landsat-9",
                "landsat:correction": "L2SP",
                "eo:cloud_cover": 10,
            },
        },
        {
            "id": "not-l2sp",
            "properties": {
                "platform": "landsat-8",
                "landsat:correction": "L2SR",
                "eo:cloud_cover": 0,
            },
        },
    ]
    assert select_scene_for_year(features, 2022)["id"] == "clear"


def test_july_search_is_bounded_to_the_pilot_window():
    params = stac_search_params(2024)
    assert params["datetime"] == "2024-07-01/2024-07-31"
    assert params["limit"] == "30"
    assert params["collections"] == "landsat-c2-l2"


def test_signed_query_is_redacted():
    assert redact_url_query("https://example.invalid/scene.tif?sig=secret") == (
        "https://example.invalid/scene.tif?[redacted]"
    )
    assert "secret" not in redact_url_query("https://example.invalid/scene.tif?sig=secret")


def test_clip_window_intersects_and_rejects_a_miss():
    assert clip_pixel_window(-1, -1, 4, 3, 10, 10) == (0, 0, 3, 2)
    with pytest.raises(ValueError, match="does not intersect"):
        clip_pixel_window(20, 20, 2, 2, 10, 10)


def test_manifest_checksums_use_unsigned_asset_hrefs(tmp_path: Path):
    (tmp_path / "red.tif").write_bytes(b"abc")
    item = {
        "id": "scene",
        "assets": {band: {"href": f"https://example.invalid/{band}.tif"} for band in BANDS},
    }
    manifest = scene_manifest(tmp_path, item)
    assert manifest["files"]["red.tif"] == hashlib.sha256(b"abc").hexdigest()
    assert all("?" not in href for href in manifest["assets"].values())
    assert file_sha256_map(tmp_path)["red.tif"] == manifest["files"]["red.tif"]


def test_pilot_limitations_say_the_window_is_not_a_district():
    assert "distrito" in PILOT_LIMITATIONS[0]
    assert "district" in PILOT_WINDOW_IS_NOT_A_DISTRICT
    snapshot = build_pilot_snapshot([], generated_at=datetime(2024, 7, 1, tzinfo=UTC))
    assert snapshot.limitations[0] == PILOT_LIMITATIONS[0]
    assert snapshot.scenes == []


def test_read_cog_window_uses_a_local_fixture():
    pytest.importorskip("rasterio")
    import numpy as np
    from cocha_api.science.landsat import read_cog_window
    from rasterio.io import MemoryFile
    from rasterio.transform import from_bounds

    data = np.arange(16, dtype="int16").reshape(4, 4)
    profile = {
        "driver": "GTiff",
        "height": 4,
        "width": 4,
        "count": 1,
        "dtype": "int16",
        "crs": "EPSG:4326",
        "transform": from_bounds(0, 0, 4, 4, 4, 4),
    }
    with MemoryFile() as memory:
        with memory.open(**profile) as target:
            target.write(data, 1)
        with memory.open() as dataset:
            array, _transform, crs = read_cog_window(dataset, (1, 1, 3, 3))
    assert array.size < data.size
    assert array.size > 0
    assert str(crs) == "EPSG:4326" or crs.to_string() == "EPSG:4326"
