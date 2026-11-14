import type { components } from "@cocha/shared";

type Snapshot = components["schemas"]["Snapshot"];

export type TerritoryId = "piloto" | "distritos-wms" | "distritos-vector";

export type TerritoryOption = {
  id: TerritoryId;
  label: string;
  description: string;
  available: boolean;
  /** Reason shown while the option cannot be selected. */
  pending?: string;
};

export const DEFAULT_TERRITORY: TerritoryId = "piloto";

// The API exposes no territorial catalog yet (team plan A02/A03). The GAMC
// options stay disabled until the backend confirms geometries and results;
// a documented layer extent (BBOX) is not a district polygon.
export function territoryOptions(evidence: Snapshot): TerritoryOption[] {
  return [
    {
      id: "piloto",
      label: evidence.area_name,
      description:
        "Ventana rectangular de estudio. Los indicadores describen todo el rectángulo.",
      available: true,
    },
    {
      id: "distritos-wms",
      label: "Límites distritales GAMC (capa de mapa)",
      description:
        "Imagen oficial de los límites para orientarse en el mapa. No permite calcular indicadores por distrito.",
      available: false,
      pending:
        "Pendiente: el servidor aún no ofrece la capa. La clave del servicio municipal no puede usarse en el navegador.",
    },
    {
      id: "distritos-vector",
      label: "Distritos con análisis",
      description:
        "Polígonos completos de cada distrito, con versión y licencia, para calcular indicadores por distrito.",
      available: false,
      pending:
        "Pendiente: no se ha obtenido un catálogo vectorial completo y verificado de los distritos.",
    },
  ];
}

export function isTerritoryId(value: string): value is TerritoryId {
  return (
    value === "piloto" ||
    value === "distritos-wms" ||
    value === "distritos-vector"
  );
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
