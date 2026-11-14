"""Convert GAMC limite_distritos KMZ/KML into a GeoJSON for official import."""

from __future__ import annotations

import json
import re
import zipfile
from html import unescape
from pathlib import Path
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
KMZ = ROOT / "data/raw/gamc/districts/limite_distritos_gamc.kmz"
OUT = ROOT / "data/raw/gamc/districts/limite_distritos_gamc.geojson"
NS = {"kml": "http://www.opengis.net/kml/2.2"}


def parse_coords(text: str) -> list[list[float]]:
    ring: list[list[float]] = []
    for token in text.strip().split():
        parts = token.split(",")
        if len(parts) < 2:
            continue
        lon, lat = float(parts[0]), float(parts[1])
        ring.append([lon, lat])
    if ring and ring[0] != ring[-1]:
        ring.append(ring[0])
    return ring


def attr_from_description(html: str) -> dict[str, str]:
    text = unescape(html)
    found = dict(
        re.findall(
            r'atr-name">([^<]+)</span>:\s*</strong>\s*<span class="atr-value">([^<]*)</span>', text
        )
    )
    if not found:
        found = dict(re.findall(r"<strong>([^<:]+):</strong>\s*([^<]+)", text))
    return {key.strip().lower(): value.strip() for key, value in found.items()}


def district_number(attrs: dict[str, str], name: str) -> int | None:
    raw = attrs.get("distrito") or attrs.get("id_distrito") or ""
    match = re.search(r"(\d{1,2})", raw) or re.search(r"(\d{1,2})", name)
    if not match:
        return None
    number = int(match.group(1))
    if 1 <= number <= 15:
        return number
    return None


def load_kml_text(path: Path) -> str:
    if path.suffix.lower() == ".kmz":
        with zipfile.ZipFile(path) as archive:
            kml_name = next(n for n in archive.namelist() if n.lower().endswith(".kml"))
            return archive.read(kml_name).decode("utf-8")
    return path.read_text(encoding="utf-8")


def main() -> None:
    if not KMZ.exists():
        raise SystemExit(f"Missing {KMZ}")
    root = ET.fromstring(load_kml_text(KMZ))
    grouped: dict[int, dict] = {}
    skipped = 0
    for placemark in root.findall(".//kml:Placemark", NS):
        name = (placemark.findtext("kml:name", default="", namespaces=NS) or "").strip()
        description = placemark.findtext("kml:description", default="", namespaces=NS) or ""
        attrs = attr_from_description(description)
        number = district_number(attrs, name)
        coord_nodes = placemark.findall(".//kml:coordinates", NS)
        polygons: list[list[list[list[float]]]] = []
        for node in coord_nodes:
            ring = parse_coords(node.text or "")
            if len(ring) >= 4:
                polygons.append([ring])
        if number is None or not polygons:
            skipped += 1
            continue
        display = attrs.get("comuna") or attrs.get("nombre") or f"Distrito {number}"
        current = grouped.setdefault(
            number,
            {
                "number": number,
                "name": f"Distrito {number} — {display}"
                if display and not display.lower().startswith("distrito")
                else display,
                "official_id": attrs.get("distrito") or f"D{number}",
                "ogc_fid": attrs.get("ogc_fid"),
                "comuna": attrs.get("comuna"),
                "parts": [],
            },
        )
        current["parts"].extend(polygons)

    if sorted(grouped) != list(range(1, 16)):
        raise SystemExit(f"Expected districts 1..15, got {sorted(grouped)} skipped={skipped}")

    features = []
    for number in range(1, 16):
        item = grouped[number]
        geometry = (
            {"type": "Polygon", "coordinates": item["parts"][0]}
            if len(item["parts"]) == 1
            else {"type": "MultiPolygon", "coordinates": item["parts"]}
        )
        if geometry["type"] == "Polygon":
            geometry = {"type": "MultiPolygon", "coordinates": [item["parts"][0]]}
        features.append(
            {
                "type": "Feature",
                "properties": {
                    "number": number,
                    "name": item["name"],
                    "official_id": item["official_id"],
                    "comuna": item["comuna"],
                    "source": "GAMC WMS limite_distritos KMZ",
                    "synthetic": False,
                    "demo": False,
                },
                "geometry": geometry,
            }
        )

    document = {
        "type": "FeatureCollection",
        "name": "gamc_limite_distritos",
        "crs": {"type": "name", "properties": {"name": "urn:ogc:def:crs:OGC:1.3:CRS84"}},
        "features": features,
        "metadata": {
            "authorization": "gamc_wms_kml",
            "layer": "limite_distritos",
            "service_id": "7eb13092-bf0e-493b-aae6-03c43eedda2c",
            "source_url": "https://serviciosgamc.cochabamba.bo/api/gs/wms",
            "note": (
                "Official GAMC district polygons retrieved as WMS KML (kmscore=100). "
                "Not a third-party reconstruction."
            ),
        },
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(document, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {OUT.relative_to(ROOT)} features={len(features)} skipped_parts={skipped}")


if __name__ == "__main__":
    main()
