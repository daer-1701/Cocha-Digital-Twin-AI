// Local synthetic API for frontend work without Python, Docker or a database.
import { createServer } from "node:http";
import { responseSchema, validate } from "./contract.mjs";
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

for (const [name, scenario] of Object.entries(scenarios)) {
  const schema = responseSchema("/v1/explorer", scenario.status);
  if (!schema) continue;
  const errors = validate(schema, scenario.body);
  if (errors.length) {
    console.error(`Scenario "${name}" does not match OpenAPI:\n  ${errors.join("\n  ")}`);
    process.exit(1);
  }
}

const fixed = {
  "/health/live": { status: 200, body: { status: "ok", service: "cocha-api" } },
  "/v1/datasets": { status: 200, body: [] },
};

function send(response, status, body) {
  response.writeHead(status, { "content-type": "application/json", ...SOURCE_HEADER });
  response.end(JSON.stringify(body));
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
  const { pathname } = new URL(request.url ?? "/", `http://${HOST}`);
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
