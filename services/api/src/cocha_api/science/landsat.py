"""Landsat 8/9 C2 L2 helpers for the bounded pilot window.

The pilot bounds are a study rectangle. They are not district polygons and
they are not the municipality. Scene selection fails when a requested year
has no compatible July scene. Network downloads stay in the CLI.
"""

import hashlib
import time
from collections.abc import Iterable, Mapping
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import numpy as np
from numpy.typing import NDArray

STAC_ROOT = "https://planetarycomputer.microsoft.com/api/stac/v1"
PILOT_BOUNDS_WGS84 = (-66.18, -17.41, -66.14, -17.37)
BANDS = ("red", "nir08", "lwir11", "qa_pixel", "qa_radsat")
MIN_YEAR = 2014
MAX_YEAR = 2025
MAX_YEARS = 5
PILOT_WINDOW_IS_NOT_A_DISTRICT = (
    "Pilot window is a rectangle, not a district polygon and not the municipality."
)
PILOT_LIMITATIONS = (
    "Ventana rectangular de estudio; no representa un distrito ni todo el municipio.",
    "Una escena de julio por año, elegida por nubosidad global de escena; no es una media anual.",
    "LST es temperatura superficial al paso del satélite, no temperatura del aire.",
    "Píxel entregado de 30 m; información térmica nativa de 100 m; mapa agregado a unos 360 m.",
    "Sin ajuste por aerosoles ni umbral ST_QA; posibles sesgos de emisividad, nubes y muestreo.",
    "Comparación descriptiva: tres fechas no permiten inferir "
    "tendencias climáticas ni significancia.",
    "Sin calibración con estaciones MÓNICA; sin predicciones ni escenarios causales.",
)
PILOT_METHOD = (
    "QA_PIXEL bits 0–5 excluded; QA_RADSAT=0; shared valid "
    "LST/NDVI mask; USGS scales; mean of valid pixels."
)


class SceneNotFoundError(RuntimeError):
    """A bounded pilot year has no compatible Landsat scene."""


def indicators(
    red: NDArray,
    nir: NDArray,
    thermal: NDArray,
    qa: NDArray,
    saturation: NDArray,
) -> tuple[NDArray, NDArray]:
    if len({band.shape for band in (red, nir, thermal, qa, saturation)}) != 1:
        raise ValueError("Bands must share the same grid")
    # QA_PIXEL bits 0..5: fill, dilated cloud, cirrus, cloud, shadow, snow.
    valid = ((qa & 63) == 0) & (saturation == 0)
    valid &= (red > 0) & (nir > 0) & (thermal > 0)
    r = red.astype(float) * 0.0000275 - 0.2
    n = nir.astype(float) * 0.0000275 - 0.2
    valid &= (r >= 0) & (r <= 1) & (n >= 0) & (n <= 1) & ((n + r) > 1e-8)
    ndvi = np.full(red.shape, np.nan)
    np.divide(n - r, n + r, out=ndvi, where=valid)
    lst = np.where(valid, thermal.astype(float) * 0.00341802 + 149.0 - 273.15, np.nan)
    return lst, ndvi


def finite_mean(values: NDArray) -> float | None:
    valid = values[np.isfinite(values)]
    return round(float(valid.mean()), 4) if valid.size else None


def validate_bounded_years(years: Iterable[int]) -> list[int]:
    unique = sorted(set(years))
    if (
        not unique
        or len(unique) > MAX_YEARS
        or any(year < MIN_YEAR or year > MAX_YEAR for year in unique)
    ):
        raise ValueError(
            f"Pilot allows at most {MAX_YEARS} years between {MIN_YEAR} and {MAX_YEAR}"
        )
    return unique


def stac_search_url(root: str = STAC_ROOT) -> str:
    return f"{root}/search"


def stac_search_params(
    year: int, bounds: tuple[float, float, float, float] = PILOT_BOUNDS_WGS84
) -> dict[str, str]:
    return {
        "collections": "landsat-c2-l2",
        "bbox": ",".join(map(str, bounds)),
        "datetime": f"{year}-07-01/{year}-07-31",
        "limit": "30",
    }


def select_scene_for_year(features: Iterable[Mapping[str, Any]], year: int) -> dict[str, Any]:
    candidates = [
        dict(item)
        for item in features
        if item.get("properties", {}).get("platform") in ("landsat-8", "landsat-9")
        and item.get("properties", {}).get("landsat:correction") == "L2SP"
    ]
    if not candidates:
        raise SceneNotFoundError(f"No compatible scene found for {year}")
    return min(
        candidates, key=lambda item: (item["properties"].get("eo:cloud_cover", 100), item["id"])
    )


def redact_url_query(url: str) -> str:
    base, separator, _query = url.partition("?")
    if not separator:
        return base
    return f"{base}?[redacted]"


def clip_pixel_window(
    col_off: int,
    row_off: int,
    width: int,
    height: int,
    raster_width: int,
    raster_height: int,
) -> tuple[int, int, int, int]:
    if min(raster_width, raster_height, width, height) <= 0:
        raise ValueError("Raster and window dimensions must be positive")
    col0 = max(0, col_off)
    row0 = max(0, row_off)
    col1 = min(raster_width, col_off + width)
    row1 = min(raster_height, row_off + height)
    if col1 <= col0 or row1 <= row0:
        raise ValueError("Requested window does not intersect the raster")
    return col0, row0, col1 - col0, row1 - row0


def read_cog_window(
    dataset: Any, bounds_wgs84: tuple[float, float, float, float]
) -> tuple[Any, Any, Any]:
    """Read one band over the intersection of bounds with a local or remote dataset.

    Callers must not log signed URLs. This helper does not open a network connection
    by itself; the dataset object is supplied by the caller.
    """

    from rasterio.warp import transform_bounds
    from rasterio.windows import Window, from_bounds

    if dataset.crs is None:
        raise ValueError("Raster CRS is missing")
    projected = transform_bounds("EPSG:4326", dataset.crs, *bounds_wgs84)
    window = from_bounds(*projected, transform=dataset.transform).round_offsets().round_lengths()
    col, row, width, height = clip_pixel_window(
        int(window.col_off),
        int(window.row_off),
        int(window.width),
        int(window.height),
        int(dataset.width),
        int(dataset.height),
    )
    clipped = Window(col, row, width, height)
    array = dataset.read(1, window=clipped)
    return array, dataset.window_transform(clipped), dataset.crs


def file_sha256_map(folder: Path) -> dict[str, str]:
    return {
        path.name: hashlib.sha256(path.read_bytes()).hexdigest()
        for path in sorted(folder.iterdir())
        if path.is_file()
    }


def scene_manifest(folder: Path, item: Mapping[str, Any]) -> dict[str, Any]:
    assets = item.get("assets", {})
    return {
        "id": item["id"],
        "assets": {band: assets[band]["href"] for band in BANDS},
        "files": file_sha256_map(folder),
    }


def get_json(client: Any, url: str, params: dict[str, str] | None = None) -> dict[str, Any]:
    response = None
    for attempt in range(4):
        response = client.get(url, params=params)
        if response.status_code not in (429, 502, 503, 504) or attempt == 3:
            break
        time.sleep(min(20, 3 * 2**attempt))
    if response is None:
        raise RuntimeError("STAC request was not sent")
    response.raise_for_status()
    payload = response.json()
    if not isinstance(payload, dict):
        raise ValueError("STAC response must be a JSON object")
    return payload


def read_scene_grids(
    client: Any, item: Mapping[str, Any], folder: Path
) -> tuple[NDArray, NDArray, Any, Any]:
    import rasterio

    arrays: dict[str, Any] = {}
    reference = None
    crs = None
    token_cache: dict[str, str] = {}
    for band in BANDS:
        cached = folder / f"{band}.tif"
        if cached.exists():
            with rasterio.open(cached) as source:
                if source.crs is None:
                    raise ValueError("Cached raster CRS is missing")
                if reference is not None and (source.transform != reference or source.crs != crs):
                    raise ValueError("Cached bands have different grids")
                reference, crs = source.transform, source.crs
                arrays[band] = source.read(1)
            continue
        if client is None:
            raise ValueError(f"Missing cached band {band} for offline replay")
        asset = item["assets"][band]["href"]
        container = "/".join(asset.split("/")[:4])
        if container not in token_cache:
            signed = get_json(
                client,
                "https://planetarycomputer.microsoft.com/api/sas/v1/sign",
                {"href": asset},
            )["href"]
            token_cache[container] = signed.split("?", 1)[1]
        signed = asset + "?" + token_cache[container]
        # GDAL reads only intersecting COG blocks. Never log signed URLs.
        with rasterio.Env(GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR", GDAL_HTTP_TIMEOUT="30"):
            with rasterio.open(signed) as source:
                arrays[band], transform, source_crs = read_cog_window(source, PILOT_BOUNDS_WGS84)
                if reference is not None and (transform != reference or source_crs != crs):
                    raise ValueError("Scene bands have different grids")
                reference, crs = transform, source_crs
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
    return lst, ndvi, reference, crs


def read_scene(client: Any, item: Mapping[str, Any], folder: Path) -> Any:
    import rasterio
    from rasterio.windows import Window

    from cocha_api.schemas.explorer import Cell, Scene

    lst, ndvi, reference, crs = read_scene_grids(client, item, folder)
    height, width = lst.shape
    cells = []
    # Native 30 m grid aggregated in 12x12-pixel blocks (~360 m); no invented detail.
    for row in range(0, height, 12):
        for col in range(0, width, 12):
            block = Window(col, row, min(12, width - col), min(12, height - row))
            transform = rasterio.windows.transform(block, reference)
            bounds = rasterio.transform.array_bounds(int(block.height), int(block.width), transform)
            geographic = rasterio.warp.transform_bounds(crs, "EPSG:4326", *bounds)
            row_slice = slice(row, row + int(block.height))
            col_slice = slice(col, col + int(block.width))
            cells.append(
                Cell(
                    bounds=geographic,
                    lst=finite_mean(lst[row_slice, col_slice]),
                    ndvi=finite_mean(ndvi[row_slice, col_slice]),
                )
            )
    return Scene(
        id=item["id"],
        acquired_at=item["properties"]["datetime"],
        platform=item["properties"]["platform"],
        source_url=f"{STAC_ROOT}/collections/landsat-c2-l2/items/{item['id']}",
        valid_fraction=float(np.isfinite(lst).mean()),
        valid_pixels=int(np.isfinite(lst).sum()),
        total_pixels=int(lst.size),
        lst_mean=finite_mean(lst),
        ndvi_mean=finite_mean(ndvi),
        cells=cells,
    )


def build_pilot_snapshot(scenes: list[Any], *, generated_at: datetime | None = None) -> Any:
    from cocha_api.schemas.explorer import Snapshot

    return Snapshot(
        generated_at=generated_at or datetime.now(UTC),
        area_name="Cochabamba · ventana urbana de estudio",
        bounds=PILOT_BOUNDS_WGS84,
        product_version="USGS Collection 2 Level-2, Landsat 8/9",
        license="Landsat open data; USGS/NASA attribution",
        method=PILOT_METHOD,
        limitations=list(PILOT_LIMITATIONS),
        scenes=sorted(scenes, key=lambda scene: scene.acquired_at),
    )
