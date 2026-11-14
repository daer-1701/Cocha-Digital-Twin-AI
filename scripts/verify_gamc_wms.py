"""Verify GAMC WMS configuration and optional live probe (EF09).

Never prints secret values. Without GAMC_WMS_API_KEY, records unavailable status
and exits 0 for documentation runs. With a key and --live, issues one GetMap
per allowlisted layer using documented BBOX extents.
"""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import UTC, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "services" / "api" / "src"))

from cocha_api.science.gamc_catalog import (  # noqa: E402
    GAMC_WMS_DEFAULT_ENDPOINT,
    GAMC_WMS_LAYERS,
    GAMC_WMS_VERSION,
)

CATALOG = ROOT / "data" / "catalog" / "gamc.json"
OUTPUT = ROOT / "data" / "catalog" / "wms_verification.json"


def load_bounds() -> dict[str, list[float]]:
    payload = json.loads(CATALOG.read_text(encoding="utf-8"))
    return {
        layer["name"]: layer["documented_bounds_wgs84"]
        for layer in payload.get("layers", [])
        if "documented_bounds_wgs84" in layer
    }


def probe_layer(service_id: str, bounds: list[float], api_key: str) -> dict[str, object]:
    west, south, east, north = bounds
    # Match the official GAMC examples: service_id + empty LAYERS.
    params = {
        "service": "WMS",
        "version": GAMC_WMS_VERSION,
        "request": "GetMap",
        "service_id": service_id,
        "layers": "",
        "styles": "",
        "srs": "EPSG:4326",
        "bbox": f"{west},{south},{east},{north}",
        "width": "256",
        "height": "256",
        "format": "image/png",
        "transparent": "true",
        "key": api_key,
    }
    url = f"{GAMC_WMS_DEFAULT_ENDPOINT}?{urllib.parse.urlencode(params)}"
    request = urllib.request.Request(url, headers={"User-Agent": "CochaDigitalTwin/0.1"})
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            content = response.read(200_000)
            content_type = response.headers.get("Content-Type", "")
            return {
                "ok": response.status == 200 and "image" in content_type.lower(),
                "status_code": response.status,
                "content_type": content_type.split(";")[0],
                "bytes": len(content),
            }
    except urllib.error.HTTPError as error:
        return {"ok": False, "status_code": error.code, "error": "http_error"}
    except urllib.error.URLError:
        return {"ok": False, "error": "network_error"}


def main(argv: list[str] | None = None) -> None:
    live = "--live" in (argv or sys.argv[1:])
    api_key = os.environ.get("GAMC_WMS_API_KEY", "").strip()
    bounds = load_bounds()
    layers: list[dict[str, object]] = []
    for layer in GAMC_WMS_LAYERS:
        entry: dict[str, object] = {
            "name": layer["name"],
            "service_id": layer["service_id"],
            "bbox_documented": bounds.get(layer["name"]),
        }
        if live and api_key:
            entry["live_probe"] = probe_layer(
                layer["service_id"],
                bounds[layer["name"]],
                api_key,
            )
        elif live:
            entry["live_probe"] = {"ok": False, "error": "key_missing"}
        else:
            entry["live_probe"] = {"skipped": True, "reason": "pass --live to probe"}
        layers.append(entry)

    document = {
        "task": "EF09",
        "verified_on": datetime.now(UTC).isoformat(),
        "endpoint": GAMC_WMS_DEFAULT_ENDPOINT,
        "wms_version": GAMC_WMS_VERSION,
        "api_key_present": bool(api_key),
        "live_requested": live,
        "layers": layers,
        "relief_3d": {
            "ui_source": "AWS Terrain Tiles Terrarium (elevation-tiles-prod)",
            "registry": "https://registry.opendata.aws/terrain-tiles/",
            "attribution_in_ui": True,
            "precision_claim": (
                "Visual hillshade/DEM tiles for MapLibre terrain. Not a surveyed "
                "municipal DEM and not equivalent to GAMC Cota 2750."
            ),
            "gamc_cota_2750": (
                "WMS context layer only; GetMap image, not a downloadable DEM product"
            ),
        },
        "quota_and_license": {
            "wms_quota": "Not published in reviewed GAMC docs; treat as unknown",
            "wms_license": "Not confirmed; key stays server-side",
            "terrain_tiles_license": "AWS Open Data / Terrain Tiles terms; attribution required",
        },
    }
    OUTPUT.write_text(json.dumps(document, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {OUTPUT.relative_to(ROOT).as_posix()}")
    print(f"api_key_present={bool(api_key)} live={live}")
    if live and not api_key:
        print("Live probe skipped: set GAMC_WMS_API_KEY in the environment (do not commit it)")


if __name__ == "__main__":
    main()
