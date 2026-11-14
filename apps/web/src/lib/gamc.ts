export const GAMC_DISTRICTS_ID = "7eb13092-bf0e-493b-aae6-03c43eedda2c";
export const GAMC_BLOCKS_ID = "194a02a0-a73a-48c1-a260-82847c5c905d";

/** WGS84 extent [west, south, east, north] from the GAMC service sheet (Limite Urbano). */
export const GAMC_EXTENT: [number, number, number, number] = [
  -66.251426, -17.50846, -66.084188, -17.332785,
];

export type FeatureProperties = Record<string, string | number | null>;

export type FeatureInfoResponse =
  | { status: "available"; features: FeatureProperties[] }
  | { status: "empty"; features: [] }
  | { status: "unavailable"; reason: string };

export const insideExtent = (lng: number, lat: number) => {
  const [w, s, e, n] = GAMC_EXTENT;
  return lng >= w && lng <= e && lat >= s && lat <= n;
};

export const intersectsExtent = ([w, s, e, n]: [number, number, number, number]) => {
  const [ew, es, ee, en] = GAMC_EXTENT;
  return w < ee && e > ew && s < en && n > es;
};
