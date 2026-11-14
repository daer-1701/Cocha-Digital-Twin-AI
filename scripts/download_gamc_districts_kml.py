"""Download GAMC Limite Distritos as KML/KMZ via the authorized WMS proxy.

GeoServer GetMap KML returns official placemark polygons. Requires GAMC_WMS_API_KEY
in the environment or .env. The key is never written to disk.
"""

from __future__ import annotations

import os
import urllib.parse
import urllib.request
from datetime import UTC, datetime
from pathlib import Path

from cocha_api.core.config import get_settings
from cocha_api.science.gamc_catalog import GAMC_WMS_DEFAULT_ENDPOINT

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "data/raw/gamc/districts"
SERVICE_ID = "7eb13092-bf0e-493b-aae6-03c43eedda2c"
BBOX = "-66.280703,-17.53119,-66.06952,-17.257306"


def _key() -> str:
    settings = get_settings()
    secret = settings.gamc_wms_api_key.get_secret_value() if settings.gamc_wms_api_key else ""
    key = (secret or os.environ.get("GAMC_WMS_API_KEY") or "").strip()
    if not key:
        raise SystemExit("GAMC_WMS_API_KEY missing")
    return key


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    params = {
        "key": _key(),
        "service_id": SERVICE_ID,
        "SERVICE": "WMS",
        "VERSION": "1.1.1",
        "REQUEST": "GetMap",
        "LAYERS": "",
        "SRS": "EPSG:4326",
        "BBOX": BBOX,
        "WIDTH": "2048",
        "HEIGHT": "2048",
        "FORMAT": "application/vnd.google-earth.kmz",
        "TRANSPARENT": "true",
        "format_options": "kmscore:100;kmattr:true",
    }
    url = f"{GAMC_WMS_DEFAULT_ENDPOINT}?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(url, headers={"User-Agent": "CochaDigitalTwin/0.1"})
    with urllib.request.urlopen(req, timeout=60) as response:
        content = response.read()
        content_type = response.headers.get("Content-Type", "")
    dest = OUT_DIR / "limite_distritos_gamc.kmz"
    dest.write_bytes(content)
    sidecar = OUT_DIR / "limite_distritos_gamc.kmz.json"
    sidecar.write_text(
        __import__("json").dumps(
            {
                "source": "GAMC WMS GetMap KMZ",
                "endpoint": GAMC_WMS_DEFAULT_ENDPOINT,
                "service_id": SERVICE_ID,
                "layer_name": "limite_distritos",
                "bbox_wgs84": [float(v) for v in BBOX.split(",")],
                "format_options": "kmscore:100;kmattr:true",
                "retrieved_at": datetime.now(UTC).isoformat(),
                "bytes": len(content),
                "content_type": content_type.split(";")[0],
                "authorization": "project WMS key (not stored here)",
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    print(f"wrote {dest.relative_to(ROOT)} bytes={len(content)} ctype={content_type.split(';')[0]}")


if __name__ == "__main__":
    main()
