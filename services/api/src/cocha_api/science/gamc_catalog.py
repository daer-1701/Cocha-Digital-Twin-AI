"""Sanitized GAMC allowlists derived from data/catalog/gamc.json."""

from typing import Final

# Hardcoded from the verified catalog; do not accept arbitrary upstream IDs.
GAMC_WMS_SERVICE_IDS: Final[frozenset[str]] = frozenset(
    {
        "fd77d463-9729-4c66-b686-23dccbb4ab8f",  # Limite Urbano
        "297cefa4-0832-42bb-a98e-2cbea989fd9d",  # Cota 2750
        "47360ddc-e35f-4ece-a995-59e90eb79cc6",  # Áreas Verdes
        "7eb13092-bf0e-493b-aae6-03c43eedda2c",  # Limite Distritos
        "194a02a0-a73a-48c1-a260-82847c5c905d",  # Población por Manzanas
    }
)

GAMC_WMS_LAYERS: Final[tuple[dict[str, str], ...]] = (
    {
        "name": "Limite Urbano",
        "service_id": "fd77d463-9729-4c66-b686-23dccbb4ab8f",
    },
    {
        "name": "Cota 2750",
        "service_id": "297cefa4-0832-42bb-a98e-2cbea989fd9d",
    },
    {
        "name": "Áreas Verdes",
        "service_id": "47360ddc-e35f-4ece-a995-59e90eb79cc6",
    },
    {
        "name": "Limite Distritos",
        "service_id": "7eb13092-bf0e-493b-aae6-03c43eedda2c",
    },
    {
        "name": "Población por Manzanas",
        "service_id": "194a02a0-a73a-48c1-a260-82847c5c905d",
    },
)

GAMC_WMS_DEFAULT_ENDPOINT: Final[str] = "https://serviciosgamc.cochabamba.bo/api/gs/wms"
GAMC_WMS_VERSION: Final[str] = "1.1.1"
ALLOWED_CRS: Final[frozenset[str]] = frozenset({"EPSG:4326", "EPSG:3857"})
VECTOR_DISTRICTS_BLOCKER: Final[str] = (
    "Official GAMC Limite Distritos polygons are not imported in PostGIS yet. "
    "Expected boundary_version prefix gamc-official- (15 municipal districts). "
    "WMS Limite Distritos imagery is orientation only. "
    "Do not treat demo-synthetic-v1 rectangles as GAMC boundaries."
)
VECTOR_DISTRICTS_AVAILABLE: Final[str] = (
    "Official GAMC Limite Distritos polygons are available from PostGIS. "
    "Use /v1/territories/districts for the catalog. "
    "Boundaries alone are not LST/NDVI indicators; those require accepted "
    "zonal statistics on /v1/series. "
    "Do not treat demo-synthetic-v1 rectangles as GAMC boundaries."
)

# Pilot bounds from the Landsat MVP; not municipal district polygons.
PILOT_BOUNDS_WGS84: Final[tuple[float, float, float, float]] = (
    -66.18,
    -17.41,
    -66.14,
    -17.37,
)

# Unit is absent from the CSV header. Official Red MoniCA reports use µg/m³.
MONICA_PM10_UNIT: Final[str] = "ug/m3"
MONICA_PM10_UNIT_SOURCE: Final[str] = (
    "http://snia.mmaya.gob.bo/web/modulos/PNGCA/publicaciones/items/"
    "14042022-030417-130459_209/14042022-030417-130459_209.pdf"
)
MONICA_PM10_UNIT_NOTE: Final[str] = (
    "Declared from municipal/national Red MoniCA reports (ug/m3), not from the "
    "CSV header. Timezone America/La_Paz and station coordinates confirmed "
    "2026-11-14; analysis_enabled stays false until Mateo accepts series QA (MF06)."
)

MONICA_TIMEZONE: Final[str] = "America/La_Paz"

# Zeros/negatives: no instrument codes from the provider. Project policy.
MONICA_QA_POLICY: Final[str] = (
    "Preserve raw values. Flag zero and negative PM10. Exclude them from "
    "physical aggregates (analysis_eligible requires valid only). Never clamp "
    "negatives to zero or convert zeros to missing without a written instrument note."
)

# App display for the project is allowed; do not publish raw CSV outside the team.
MONICA_LICENSE_POLICY: Final[str] = (
    "Project may show imported records in the app. Keep raw CSV/ZIP outside Git. "
    "Do not republish the source archive publicly without a written redistribution grant."
)

MONICA_METADATA_PENDING: Final[tuple[str, ...]] = (
    "instrument manufacturer QA codes (zeros/negatives handled by project policy)",
    "written redistribution grant beyond project app display",
)

# Identity + coordinates confirmed 2026-11-14 (team/GAMC). Elevations approximate.
STATION_CATALOG_PROFILE: Final[tuple[dict[str, object], ...]] = (
    {
        "source_id": "kanata",
        "name": "Parque Kanata",
        "csv_label": "kanata",
        "described_location": "Av. 6 de Agosto / Av. del Cabildo",
        "variable": "pm10",
        "unit": MONICA_PM10_UNIT,
        "unit_source": MONICA_PM10_UNIT_SOURCE,
        "timezone": MONICA_TIMEZONE,
        "latitude": -17.41252,
        "longitude": -66.15897,
        "elevation_m": 2564.0,
        "elevation_note": "approx 2554-2574 m asl",
    },
    {
        "source_id": "semapa",
        "name": "SEMAPA",
        "csv_label": "semapa",
        "described_location": "Predios SEMAPA / Planta Cala Cala (Av. Circunvalación / Atahuallpa)",
        "variable": "pm10",
        "unit": MONICA_PM10_UNIT,
        "unit_source": MONICA_PM10_UNIT_SOURCE,
        "timezone": MONICA_TIMEZONE,
        "latitude": -17.36470,
        "longitude": -66.16245,
        "elevation_m": 2600.0,
        "elevation_note": "approx 2600 m asl",
    },
)
