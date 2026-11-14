"""Extract Cochabamba Cercado (INE 030101) districts from a third-party catalog.

Writes a REVIEW candidate only. Does NOT authorize official GAMC import.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "data/raw/gamc/districts/candidates/hogaria_distritos.geojson"
DEST = ROOT / "data/raw/gamc/districts/candidates/cochabamba_15_candidate_unverified.geojson"


def main() -> None:
    if not SRC.exists():
        raise SystemExit(f"Missing source catalog: {SRC}")
    payload = json.loads(SRC.read_text(encoding="utf-8"))
    features: list[dict] = []
    for feature in payload.get("features", []):
        props = feature.get("properties") or {}
        if str(props.get("municipio_ine")) != "030101":
            continue
        number = int(props["codigo_distrito"])
        name = str(props.get("nombre") or f"Distrito {number}")
        features.append(
            {
                "type": "Feature",
                "properties": {
                    "number": number,
                    "name": name,
                    "official_id": str(props.get("codigo")),
                    "municipio_ine": "030101",
                    "fuente_upstream": str(props.get("fuente")),
                    "candidate_status": "third_party_unverified",
                    "synthetic": False,
                    "demo": False,
                    "note": (
                        "NOT GAMC-authorized; third-party via hogaria/ciudatoslab; "
                        "review only; do not pass --i-confirm-authorized-gamc-vector"
                    ),
                },
                "geometry": feature.get("geometry"),
            }
        )
    features = sorted(features, key=lambda item: item["properties"]["number"])
    if [item["properties"]["number"] for item in features] != list(range(1, 16)):
        raise SystemExit(f"Expected numbers 1..15, got {[f['properties']['number'] for f in features]}")

    document = {
        "type": "FeatureCollection",
        "name": "cochabamba_cercado_districts_candidate_unverified",
        "crs": {"type": "name", "properties": {"name": "urn:ogc:def:crs:OGC:1.3:CRS84"}},
        "features": features,
        "metadata": {
            "authorization": "not_gamc_official",
            "source_files": ["https://hogaria.com/geo/datos/distritos.geojson"],
            "upstream_attribution": "ciudatoslab via hogaria; third party / ODbL-like",
            "feature_count": len(features),
            "municipio_ine": "030101",
            "do_not_import_as_official": True,
        },
    }
    text = json.dumps(document, ensure_ascii=False, indent=2) + "\n"
    DEST.parent.mkdir(parents=True, exist_ok=True)
    DEST.write_text(text, encoding="utf-8")
    digest = hashlib.sha256(text.encode("utf-8")).hexdigest()
    print(f"wrote {DEST.relative_to(ROOT)} features={len(features)} sha256={digest[:16]}")
    print("NOT authorized for official import")


if __name__ == "__main__":
    main()
