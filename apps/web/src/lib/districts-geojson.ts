import type { components } from "@cocha/shared";

export type OfficialDistrict = components["schemas"]["OfficialDistrictItem"];

type Ring = [number, number][];

function asRing(raw: unknown): Ring | null {
  if (!Array.isArray(raw) || raw.length < 4) return null;
  const ring: Ring = [];
  for (const point of raw) {
    if (!Array.isArray(point) || point.length < 2) return null;
    const lng = Number(point[0]);
    const lat = Number(point[1]);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
    ring.push([lng, lat]);
  }
  return ring;
}

/** Build MapLibre GeoJSON from official district rows (no invented metrics). */
export function districtFeatureCollection(districts: OfficialDistrict[]) {
  const features = districts.flatMap((district, index) => {
    const geometry = district.geometry;
    if (!geometry || typeof geometry !== "object") return [];
    const type = "type" in geometry ? geometry.type : null;
    const coordinates = "coordinates" in geometry ? geometry.coordinates : null;
    if (typeof type !== "string" || !Array.isArray(coordinates)) return [];

    let polygons: Ring[][] = [];
    if (type === "Polygon") {
      const exterior = asRing(coordinates[0]);
      if (exterior) polygons = [[exterior]];
    } else if (type === "MultiPolygon") {
      for (const part of coordinates) {
        if (!Array.isArray(part) || !part[0]) continue;
        const exterior = asRing(part[0]);
        if (exterior) polygons.push([exterior]);
      }
    }
    if (polygons.length === 0) return [];

    return [
      {
        type: "Feature" as const,
        properties: {
          index,
          number: district.number,
          name: district.name,
          boundary_version: district.boundary_version,
          source_url: district.source_url,
        },
        geometry:
          polygons.length === 1
            ? { type: "Polygon" as const, coordinates: polygons[0] }
            : { type: "MultiPolygon" as const, coordinates: polygons },
      },
    ];
  });

  return { type: "FeatureCollection" as const, features };
}

/** WGS84 bbox of published district geometries, or null if none. */
export function districtBounds(
  districts: OfficialDistrict[],
): [number, number, number, number] | null {
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  for (const feature of districtFeatureCollection(districts).features) {
    const rings =
      feature.geometry.type === "Polygon"
        ? [feature.geometry.coordinates[0]]
        : feature.geometry.coordinates.map((polygon) => polygon[0]);
    for (const ring of rings) {
      for (const [lng, lat] of ring) {
        west = Math.min(west, lng);
        south = Math.min(south, lat);
        east = Math.max(east, lng);
        north = Math.max(north, lat);
      }
    }
  }
  if (!Number.isFinite(west)) return null;
  return [west, south, east, north];
}
