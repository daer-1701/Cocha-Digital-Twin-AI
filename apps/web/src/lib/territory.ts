import type { components } from "@cocha/shared";

type Snapshot = components["schemas"]["Snapshot"];
type Territories = components["schemas"]["TerritoriesResponse"];

export type TerritoryId = "piloto" | "distritos";

export type TerritoryOption = {
  id: TerritoryId;
  label: string;
  description: string;
  available: boolean;
  /** Reason shown while the option cannot be selected. */
  pending?: string;
  /** Verbatim server reason, if the API gave one. */
  detail?: string | null;
};

/** Default when official polygons are not published yet. */
export const DEFAULT_TERRITORY: TerritoryId = "piloto";

/**
 * Prefer official GAMC districts when the API publishes them.
 * The Landsat cell grid remains available as the pilot study window.
 */
export function preferredTerritory(available: TerritoryId[]): TerritoryId {
  if (available.includes("distritos")) return "distritos";
  if (available.includes(DEFAULT_TERRITORY)) return DEFAULT_TERRITORY;
  return available[0] ?? DEFAULT_TERRITORY;
}

// WMS district images only orient the map (see components/map-layers.tsx);
// indicators by district require accepted zonal statistics on /v1/series.
export function territoryOptions(
  evidence: Snapshot,
  catalog: Territories | null,
): TerritoryOption[] {
  return [
    {
      id: "distritos",
      label: "Distritos municipales",
      description:
        "Los 15 polígonos oficiales GAMC (Tunari, Molle, Alejo Calatayud…). Sin LST/NDVI distrital inventado.",
      available: catalog?.vector_districts.status === "available",
      pending:
        catalog?.vector_districts.status === "available"
          ? undefined
          : catalog
            ? "Pendiente: el servidor todavía no publica los 15 polígonos oficiales verificados."
            : "No se pudo consultar el catálogo territorial del servidor.",
      detail: catalog?.vector_districts.reason,
    },
    {
      id: "piloto",
      label: evidence.area_name,
      description:
        "Ventana de estudio Landsat (~360 m por celda). No son distritos municipales. Al hacer clic, la celda se eleva.",
      available: true,
    },
  ];
}

export function isTerritoryId(value: string): value is TerritoryId {
  return value === "piloto" || value === "distritos";
}

const KM_PER_DEGREE_LAT = 110.574;
const KM_PER_DEGREE_LON_EQUATOR = 111.32;

/** Width and height in km of a WGS84 [west, south, east, north] box. */
export function boundsSizeKm([west, south, east, north]: Snapshot["bounds"]) {
  const midLat = ((south + north) / 2) * (Math.PI / 180);
  return {
    width: (east - west) * KM_PER_DEGREE_LON_EQUATOR * Math.cos(midLat),
    height: (north - south) * KM_PER_DEGREE_LAT,
  };
}
