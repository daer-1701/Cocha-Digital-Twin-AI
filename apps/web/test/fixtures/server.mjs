// Local synthetic API for frontend work without Python, Docker or a database.
import { createServer } from "node:http";
import { responseSchema, validate } from "./contract.mjs";
import {
  STATION_IDS,
  WMS_LAYERS,
  domainRoutes,
  hatchPng,
  stationObservations,
} from "./domain.mjs";
import { scenarios } from "./scenarios.mjs";

// Read by apps/web/src/lib/api.ts to label every page as DEMO.
const SOURCE_HEADER = { "x-cocha-data-source": "synthetic-fixture" };
const HOST = "127.0.0.1";
const PORT = Number(process.env.FIXTURES_PORT ?? 8100);

if (process.env.NODE_ENV === "production") {
  console.error("Synthetic fixtures refuse to run with NODE_ENV=production.");
  process.exit(1);
}

const argument = process.argv.find((arg) => arg.startsWith("--scenario="));
let active = argument?.split("=")[1] ?? process.env.FIXTURE_SCENARIO ?? "valle";
if (!scenarios[active]) {
  console.error(`Unknown scenario "${active}". Options: ${Object.keys(scenarios).join(", ")}`);
  process.exit(1);
}

function assertContract(label, path, status, body) {
  const schema = responseSchema(path, status);
  if (!schema) {
    console.error(`${label}: OpenAPI documents no ${status} response for ${path}.`);
    process.exit(1);
  }
  const errors = validate(schema, body);
  if (errors.length) {
    console.error(`${label} does not match OpenAPI:\n  ${errors.join("\n  ")}`);
    process.exit(1);
  }
}

for (const [name, scenario] of Object.entries(scenarios)) {
  if (responseSchema("/v1/explorer", scenario.status))
    assertContract(`Scenario "${name}"`, "/v1/explorer", scenario.status, scenario.body);
}
const scenarioDomain = (scenario, sceneId) =>
  domainRoutes({
    wms: Boolean(scenario.wms),
    evidence: scenario.status === 200 ? (scenario.body.evidence ?? null) : null,
    districts: Boolean(scenario.districts),
    sceneId,
    monica: scenario.monica,
    quotaSpent: Boolean(scenario.quotaSpent),
  });

const OBSERVATIONS_TEMPLATE = "/v1/stations/{station_id}/observations";
for (const [name, scenario] of Object.entries(scenarios)) {
  for (const [path, body] of Object.entries(scenarioDomain(scenario)))
    assertContract(`Route ${path} (scenario "${name}")`, path, 200, body);
  if (!scenario.monica) continue;
  for (const id of Object.values(STATION_IDS))
    for (const offset of [0, 50]) {
      const params = new URLSearchParams({ limit: "50", offset: String(offset) });
      const { status, body } = stationObservations(
        scenario.monica,
        `/v1/stations/${id}/observations`,
        params,
      );
      assertContract(`Route ${OBSERVATIONS_TEMPLATE} (scenario "${name}")`, OBSERVATIONS_TEMPLATE, status, body);
    }
}

const fixed = {
  "/health/live": { status: 200, body: { status: "ok", service: "cocha-api" } },
  "/v1/datasets": { status: 200, body: [] },
};
const ALLOWED_SERVICES = new Set(WMS_LAYERS.map((layer) => layer.service_id));
const LAYER_COLORS = [
  [255, 200, 87],
  [212, 168, 255],
  [114, 223, 184],
  [143, 188, 255],
  [255, 154, 139],
];

function send(response, status, body) {
  response.writeHead(status, { "content-type": "application/json", ...SOURCE_HEADER });
  response.end(JSON.stringify(body));
}

function sendWms(response, pathname, params) {
  if (!scenarios[active].wms)
    return send(response, 503, {
      detail: { status: "unavailable", reason: "GAMC_WMS_API_KEY is not configured" },
    });
  const serviceId = params.get("service_id") ?? "";
  if (!ALLOWED_SERVICES.has(serviceId))
    return send(response, 400, {
      status: "unavailable",
      reason: "service_id is not in the verified GAMC allowlist",
    });
  const color = LAYER_COLORS[[...ALLOWED_SERVICES].indexOf(serviceId) % LAYER_COLORS.length];
  const size = pathname.endsWith("/legend") ? 24 : 256;
  response.writeHead(200, { "content-type": "image/png", ...SOURCE_HEADER });
  response.end(hatchPng(size, color));
}

function info() {
  return {
    warning: "Datos sintéticos de desarrollo. No son observaciones reales.",
    active,
    scenarios: Object.fromEntries(
      Object.entries(scenarios).map(([name, s]) => [name, s.description]),
    ),
    switch: "POST /__fixtures/scenario/<nombre>",
  };
}

const server = createServer((request, response) => {
  const { pathname, searchParams } = new URL(request.url ?? "/", `http://${HOST}`);
  if (request.method === "POST" && pathname.startsWith("/__fixtures/scenario/")) {
    const name = decodeURIComponent(pathname.split("/").pop() ?? "");
    if (!scenarios[name]) return send(response, 404, { detail: "Unknown scenario" });
    active = name;
    console.log(`Scenario: ${active}`);
    return send(response, 200, info());
  }
  if (request.method !== "GET") return send(response, 405, { detail: "Method Not Allowed" });
  if (pathname === "/__fixtures") return send(response, 200, info());
  if (fixed[pathname]) return send(response, fixed[pathname].status, fixed[pathname].body);
  if (pathname === "/v1/gamc/wms/map" || pathname === "/v1/gamc/wms/legend")
    return sendWms(response, pathname, searchParams);
  const records = stationObservations(scenarios[active].monica, pathname, searchParams);
  if (records) return send(response, records.status, records.body);
  const domain = scenarioDomain(scenarios[active], searchParams.get("scene_id"))[pathname];
  if (domain) {
    if ((pathname === "/v1/indicators" || pathname === "/v1/jobs") && domain.status === "available") {
      const limit = Number(searchParams.get("limit") ?? 50);
      const offset = Number(searchParams.get("offset") ?? 0);
      const items = domain.items.slice(offset, offset + limit);
      const page = { ...domain, limit, offset, items };
      if (pathname === "/v1/jobs") page.has_more = offset + limit < domain.items.length;
      return send(response, 200, page);
    }
    return send(response, 200, domain);
  }
  if (pathname !== "/v1/explorer") return send(response, 404, { detail: "Not Found" });

  const scenario = scenarios[active];
  if (!scenario.delayMs) return send(response, scenario.status, scenario.body);
  response.writeHead(scenario.status, { "content-type": "application/json", ...SOURCE_HEADER });
  response.flushHeaders();
  const timer = setTimeout(() => response.end(JSON.stringify(scenario.body)), scenario.delayMs);
  response.on("close", () => clearTimeout(timer));
});

server.listen(PORT, HOST, () => {
  console.log(`Synthetic fixtures on http://${HOST}:${PORT} · scenario: ${active}`);
  console.log(`Scenarios and switching: http://${HOST}:${PORT}/__fixtures`);
});
