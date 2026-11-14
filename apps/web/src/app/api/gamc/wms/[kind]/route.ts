import { apiBaseUrl, demoState } from "../../../../../lib/api";

const SERVICE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const MAX_PIXELS = 2048;

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

export async function GET(
  request: Request,
  { params }: { params: Promise<{ kind: string }> },
) {
  const { kind } = await params;
  if (kind !== "map" && kind !== "legend") return fail(404, "Unknown WMS resource");
  const incoming = new URL(request.url).searchParams;
  const serviceId = incoming.get("service_id") ?? "";
  if (!SERVICE_ID.test(serviceId)) return fail(400, "Invalid service_id");
  const query = kind === "map" ? mapQuery(incoming) : new URLSearchParams();
  if (!query) return fail(400, "Invalid bbox, width or height");
  query.set("service_id", serviceId);

  try {
    const upstream = await fetch(`${apiBaseUrl()}/v1/gamc/wms/${kind}?${query}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(25000),
    });
    if (demoState(upstream) === "blocked") return fail(503, "Synthetic fixtures blocked");
    const type = upstream.headers.get("content-type") ?? "";
    if (!upstream.ok || !type.startsWith("image/"))
      return fail(
        [429, 503].includes(upstream.status) ? upstream.status : 502,
        "WMS layer unavailable",
      );
    return new Response(upstream.body, {
      headers: { "content-type": type, "cache-control": "private, max-age=300" },
    });
  } catch {
    return fail(504, "WMS layer did not respond");
  }
}
