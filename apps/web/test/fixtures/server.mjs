// Local synthetic API for frontend work without Python, Docker or a database.
import { createServer } from "node:http";
import { responseSchema, validate } from "./contract.mjs";
import { WMS_LAYERS, domainRoutes, hatchPng } from "./domain.mjs";
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
let active = argument?.split("=")[1] ?? process.env.FIXTURE_SCENARIO ?? "available";
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
const scenarioDomain = (scenario) =>
  domainRoutes({
    wms: Boolean(scenario.wms),
    evidence: scenario.status === 200 ? (scenario.body.evidence ?? null) : null,
  });

for (const [name, scenario] of Object.entries(scenarios))
  for (const [path, body] of Object.entries(scenarioDomain(scenario)))
    assertContract(`Route ${path} (scenario "${name}")`, path, 200, body);

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
  const domain = scenarioDomain(scenarios[active])[pathname];
  if (domain) return send(response, 200, domain);
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
