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

export const DEFAULT_TERRITORY: TerritoryId = "piloto";

// WMS district images only orient the map (see components/map-layers.tsx);
// indicators by district require the complete vector catalog.
export function territoryOptions(
  evidence: Snapshot,
  catalog: Territories | null,
): TerritoryOption[] {
  return [
    {
      id: "piloto",
      label: evidence.area_name,
      description:
        "Ventana rectangular de estudio. Los indicadores describen todo el rectángulo.",
      available: true,
    },
    {
      id: "distritos",
      label: "Distritos con análisis",
      description:
        "Polígonos completos de cada distrito, con versión y licencia, para calcular indicadores por distrito.",
      available: false,
      pending: catalog
        ? "Pendiente: el servidor todavía no tiene polígonos completos y verificados de los 15 distritos."
        : "No se pudo consultar el catálogo territorial del servidor.",
      detail: catalog?.vector_districts.reason,
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
