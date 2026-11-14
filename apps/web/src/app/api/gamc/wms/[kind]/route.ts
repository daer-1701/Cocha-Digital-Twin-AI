import { apiBaseUrl, demoState } from "../../../../../lib/api";
import type { FeatureProperties } from "../../../../../lib/gamc";

const SERVICE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const MAX_PIXELS = 2048;
const MAX_FEATURES = 10;
const MAX_PROPERTIES = 30;
const MAX_TEXT = 200;

const fail = (status: number, reason: string) =>
  Response.json({ status: "unavailable", reason }, { status });

function mapQuery(params: URLSearchParams): URLSearchParams | null {
  const bbox = (params.get("bbox") ?? "").split(",").map(Number);
  const width = Number(params.get("width"));
  const height = Number(params.get("height"));
  const [west, south, east, north] = bbox;
  const validBox =
    bbox.length === 4 &&
    bbox.every(Number.isFinite) &&
    west < east &&
    south < north &&
    west >= -180 &&
    east <= 180 &&
    south >= -90 &&
    north <= 90;
  const validSize = [width, height].every(
    (n) => Number.isInteger(n) && n >= 1 && n <= MAX_PIXELS,
  );
  if (!validBox || !validSize) return null;
  return new URLSearchParams({
    bbox: bbox.join(","),
    width: String(width),
    height: String(height),
    crs: "EPSG:4326",
  });
}

function infoQuery(params: URLSearchParams): URLSearchParams | null {
  const query = mapQuery(params);
  if (!query) return null;
  const x = Number(params.get("x"));
  const y = Number(params.get("y"));
  const inside = (n: number, size: string | null) =>
    Number.isInteger(n) && n >= 0 && n < Number(size);
  if (!inside(x, query.get("width")) || !inside(y, query.get("height"))) return null;
  query.set("x", String(x));
  query.set("y", String(y));
  return query;
}

/** Keeps only flat attributes; the municipal payload is untrusted. */
function sanitizeFeatures(body: unknown): FeatureProperties[] | null {
  if (typeof body !== "object" || body === null) return null;
  const features = (body as { features?: unknown }).features;
  if (!Array.isArray(features)) return null;
  return features.slice(0, MAX_FEATURES).map((feature) => {
    const raw = (feature as { properties?: unknown } | null)?.properties;
    const clean: FeatureProperties = {};
    if (typeof raw !== "object" || raw === null) return clean;
    for (const [key, value] of Object.entries(raw).slice(0, MAX_PROPERTIES)) {
      const name = key.slice(0, 60);
      if (value === null) clean[name] = null;
      else if (typeof value === "number" && Number.isFinite(value)) clean[name] = value;
      else if (typeof value === "string") clean[name] = value.slice(0, MAX_TEXT);
    }
    return clean;
  });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ kind: string }> },
) {
  const { kind } = await params;
  if (kind !== "map" && kind !== "legend" && kind !== "feature-info")
    return fail(404, "Unknown WMS resource");
  const incoming = new URL(request.url).searchParams;
  const serviceId = incoming.get("service_id") ?? "";
  if (!SERVICE_ID.test(serviceId)) return fail(400, "Invalid service_id");
  const query =
    kind === "map"
      ? mapQuery(incoming)
      : kind === "feature-info"
        ? infoQuery(incoming)
        : new URLSearchParams();
  if (!query) return fail(400, "Invalid bbox, size or pixel");
  query.set("service_id", serviceId);

  try {
    const upstream = await fetch(`${apiBaseUrl()}/v1/gamc/wms/${kind}?${query}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(25000),
    });
    if (demoState(upstream) === "blocked") return fail(503, "Synthetic fixtures blocked");
    const status = [429, 503].includes(upstream.status) ? upstream.status : 502;
    const type = upstream.headers.get("content-type") ?? "";
    if (kind === "feature-info") {
      if (!upstream.ok || !type.includes("json")) return fail(status, "WMS query unavailable");
      const features = sanitizeFeatures(await upstream.json().catch(() => null));
      if (!features) return fail(502, "Unexpected WMS response");
      return Response.json(
        features.length
          ? { status: "available", features }
          : { status: "empty", features: [] },
        { headers: { "cache-control": "private, max-age=300" } },
      );
    }
    if (!upstream.ok || !type.startsWith("image/"))
      return fail(status, "WMS layer unavailable");
    return new Response(upstream.body, {
      headers: { "content-type": type, "cache-control": "private, max-age=300" },
    });
  } catch {
    return fail(504, "WMS layer did not respond");
  }
}
