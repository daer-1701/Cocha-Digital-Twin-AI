"""Bounded real-data pilot. Download only five small COG windows per selected scene."""

import argparse
import hashlib
import json
import subprocess
import time
from datetime import UTC, datetime
from pathlib import Path

import httpx
import numpy as np
import rasterio
from cocha_api.schemas.explorer import Cell, Scene, Snapshot
from cocha_api.science.landsat import finite_mean, indicators
from rasterio.transform import array_bounds
from rasterio.warp import transform_bounds
from rasterio.windows import Window, from_bounds

STAC = "https://planetarycomputer.microsoft.com/api/stac/v1"
BOUNDS = (-66.18, -17.41, -66.14, -17.37)
BANDS = ("red", "nir08", "lwir11", "qa_pixel", "qa_radsat")


def get_json(client: httpx.Client, url: str, params: dict | None = None) -> dict:
    for attempt in range(4):
        response = client.get(url, params=params)
        if response.status_code not in (429, 502, 503, 504) or attempt == 3:
            break
        time.sleep(min(20, 3 * 2**attempt))
    response.raise_for_status()
    return response.json()


def read_scene(client: httpx.Client, item: dict, folder: Path) -> Scene:
    arrays = {}
    reference = None
    crs = None
    token_cache = {}
    for band in BANDS:
        cached = folder / f"{band}.tif"
        if cached.exists():
            with rasterio.open(cached) as source:
                if reference is not None and (source.transform != reference or source.crs != crs):
                    raise ValueError("Cached bands have different grids")
                reference, crs = source.transform, source.crs
                arrays[band] = source.read(1)
            continue
        asset = item["assets"][band]["href"]
        container = "/".join(asset.split("/")[:4])
        if container not in token_cache:
            signed = get_json(
                client, "https://planetarycomputer.microsoft.com/api/sas/v1/sign", {"href": asset}
            )["href"]
            token_cache[container] = signed.split("?", 1)[1]
        signed = asset + "?" + token_cache[container]
        # GDAL reads only intersecting COG blocks. Never log signed URLs.
        with rasterio.Env(GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR", GDAL_HTTP_TIMEOUT="30"):
            with rasterio.open(signed) as source:
                bounds = transform_bounds("EPSG:4326", source.crs, *BOUNDS)
                window = from_bounds(*bounds, source.transform).round_offsets().round_lengths()
                window = window.intersection(Window(0, 0, source.width, source.height))
                transform = source.window_transform(window)
                if reference is not None and (transform != reference or source.crs != crs):
                    raise ValueError("Scene bands have different grids")
                reference, crs = transform, source.crs
                arrays[band] = source.read(1, window=window)
                profile = source.profile.copy()
                profile.update(
                    width=arrays[band].shape[1],
                    height=arrays[band].shape[0],
                    transform=transform,
                    driver="GTiff",
                )
                with rasterio.open(folder / f"{band}.tif", "w", **profile) as target:
                    target.write(arrays[band], 1)
    lst, ndvi = indicators(*(arrays[key] for key in BANDS))
    height, width = lst.shape
    cells = []
    # Native 30 m grid aggregated in 12x12-pixel blocks (~360 m); no invented detail.
    for row in range(0, height, 12):
        for col in range(0, width, 12):
            block = Window(col, row, min(12, width - col), min(12, height - row))
            t = rasterio.windows.transform(block, reference)
            bounds = array_bounds(int(block.height), int(block.width), t)
            geographic = transform_bounds(crs, "EPSG:4326", *bounds)
            a, b = slice(row, row + int(block.height)), slice(col, col + int(block.width))
            cells.append(
                Cell(bounds=geographic, lst=finite_mean(lst[a, b]), ndvi=finite_mean(ndvi[a, b]))
            )
    return Scene(
        id=item["id"],
        acquired_at=item["properties"]["datetime"],
        platform=item["properties"]["platform"],
        source_url=f"{STAC}/collections/landsat-c2-l2/items/{item['id']}",
        valid_fraction=float(np.isfinite(lst).mean()),
        valid_pixels=int(np.isfinite(lst).sum()),
        total_pixels=int(lst.size),
        lst_mean=finite_mean(lst),
        ndvi_mean=finite_mean(ndvi),
        cells=cells,
    )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--years", nargs="+", type=int, default=[2022, 2023, 2024])
    args = parser.parse_args()
    years = sorted(set(args.years))
    if len(years) > 5 or any(year < 2014 or year > 2025 for year in years):
        parser.error("Pilot allows at most 5 years between 2014 and 2025")
    raw = Path("data/raw/landsat-pilot")
    raw.mkdir(parents=True, exist_ok=True)
    scenes, manifests = [], []
    with httpx.Client(timeout=40, follow_redirects=True) as client:
        for year in years:
            result = get_json(
                client,
                f"{STAC}/search",
                {
                    "collections": "landsat-c2-l2",
                    "bbox": ",".join(map(str, BOUNDS)),
                    "datetime": f"{year}-07-01/{year}-07-31",
                    "limit": 30,
                },
            )
            candidates = [
                item
                for item in result["features"]
                if item["properties"].get("platform") in ("landsat-8", "landsat-9")
                and item["properties"].get("landsat:correction") == "L2SP"
            ]
            if not candidates:
                raise RuntimeError(f"No compatible scene found for {year}")
            item = min(
                candidates, key=lambda x: (x["properties"].get("eo:cloud_cover", 100), x["id"])
            )
            folder = raw / item["id"]
            folder.mkdir(exist_ok=True)
            metadata = folder / "stac.json"
            metadata.write_text(json.dumps(item, indent=2) + "\n", encoding="utf-8")
            scenes.append(read_scene(client, item, folder))
            manifests.append(
                {
                    "id": item["id"],
                    "assets": {band: item["assets"][band]["href"] for band in BANDS},
                    "files": {
                        p.name: hashlib.sha256(p.read_bytes()).hexdigest()
                        for p in sorted(folder.iterdir())
                        if p.is_file()
                    },
                }
            )
            print(f"Processed {item['id']}: {scenes[-1].valid_fraction:.1%} valid pixels")
    snapshot = Snapshot(
        generated_at=datetime.now(UTC),
        area_name="Cochabamba · ventana urbana de estudio",
        bounds=BOUNDS,
        product_version="USGS Collection 2 Level-2, Landsat 8/9",
        license="Landsat open data; USGS/NASA attribution",
        method=(
            "QA_PIXEL bits 0–5 excluded; QA_RADSAT=0; shared valid "
            "LST/NDVI mask; USGS scales; mean of valid pixels."
        ),
        limitations=[
            "Ventana rectangular de estudio; no representa un distrito ni todo el municipio.",
            "Una escena de julio por año, elegida por nubosidad global "
            "de escena; no es una media anual.",
            "LST es temperatura superficial al paso del satélite, no temperatura del aire.",
            "Píxel entregado de 30 m; información térmica nativa de 100 "
            "m; mapa agregado a unos 360 m.",
            "Sin ajuste por aerosoles ni umbral ST_QA; posibles sesgos "
            "de emisividad, nubes y muestreo.",
            "Comparación descriptiva: tres fechas no permiten inferir "
            "tendencias climáticas ni significancia.",
            "Sin calibración con estaciones MÓNICA; sin predicciones ni escenarios causales.",
        ],
        scenes=sorted(scenes, key=lambda scene: scene.acquired_at),
    )
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
                "bounds": BOUNDS,
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
