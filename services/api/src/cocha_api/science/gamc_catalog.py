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
    "Complete district vector geometries are not available. "
    "WMS GetMap/GetFeatureInfo and documented BBOX extents are not a complete "
    "vector dataset; authorized GeoJSON/GeoPackage/Shapefile or feature service "
    "access is still required before PostGIS district import."
)

# Pilot bounds from the Landsat MVP; not municipal district polygons.
PILOT_BOUNDS_WGS84: Final[tuple[float, float, float, float]] = (
    -66.18,
    -17.41,
    -66.14,
    -17.37,
)

MONICA_METADATA_PENDING: Final[tuple[str, ...]] = (
    "PM10 units",
    "timezone",
    "station coordinates and identity reconciliation",
    "measurement QA codes and zero interpretation",
    "data redistribution license",
)

STATION_CATALOG_PROFILE: Final[tuple[dict[str, str], ...]] = (
    {"source_id": "kanata", "name": "kanata"},
    {"source_id": "semapa", "name": "semapa"},
)
