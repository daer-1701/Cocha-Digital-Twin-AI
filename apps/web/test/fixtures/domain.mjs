// Synthetic availability envelopes mirroring the honest defaults of services/api.
import { deflateSync, crc32 } from "node:zlib";

const BOUNDS = [-66.18, -17.41, -66.14, -17.37];
const PAGE = { limit: 50, offset: 0 };
const GENERATED_AT = "2026-11-14T00:00:00Z";

// Same allowlist as services/api/src/cocha_api/science/gamc_catalog.py.
export const WMS_LAYERS = [
  { name: "Limite Urbano", service_id: "fd77d463-9729-4c66-b686-23dccbb4ab8f" },
  { name: "Cota 2750", service_id: "297cefa4-0832-42bb-a98e-2cbea989fd9d" },
  { name: "Áreas Verdes", service_id: "47360ddc-e35f-4ece-a995-59e90eb79cc6" },
  { name: "Limite Distritos", service_id: "7eb13092-bf0e-493b-aae6-03c43eedda2c" },
  { name: "Población por Manzanas", service_id: "194a02a0-a73a-48c1-a260-82847c5c905d" },
];

const METADATA_PENDING = [
  "PM10 units",
  "timezone",
  "station coordinates and identity reconciliation",
  "measurement QA codes and zero interpretation",
  "data redistribution license",
];

function territories(wms) {
  return {
    status: "available",
    reason: wms
      ? null
      : "Fixture: pilot area is available; WMS layers need GAMC_WMS_API_KEY; vector districts blocked.",
    pilot: {
      name: "DEMO pilot window",
      status: "available",
      bounds_wgs84: BOUNDS,
      source: "Synthetic fixture",
      note: "Synthetic fixture; not a municipal district boundary.",
    },
    wms_layers: WMS_LAYERS.map((layer) => ({
      ...layer,
      status: wms ? "available" : "unavailable",
      reason: wms ? null : "Fixture: GAMC_WMS_API_KEY is not configured.",
    })),
    vector_districts: {
      status: "unavailable",
      reason: "Fixture: complete district vector geometries are not available.",
    },
    generated_at: GENERATED_AT,
  };
}

const unavailable = (reason, extra = {}) => ({
  status: "unavailable",
  reason: `Fixture: ${reason}`,
  items: [],
  ...PAGE,
  ...extra,
});

/** GET routes outside /v1/explorer. `wms` enables the synthetic GAMC layers. */
export function domainRoutes({ wms }) {
  return {
    "/v1/territories": territories(wms),
    "/v1/indicators": unavailable("district indicators need verified district vectors."),
    "/v1/series": unavailable("district series are not published."),
    "/v1/trends": unavailable("no official trend without comparable district series."),
    "/v1/stations": {
      status: "empty",
      reason: "Fixture: no MONICA stations imported yet; analysis aggregates disabled.",
      items: ["kanata", "semapa"].map((id) => ({
        source_id: id,
        name: id,
        variable: "pm10",
        unit: null,
        timezone: null,
        analysis_enabled: false,
        metadata_pending: METADATA_PENDING,
      })),
      ...PAGE,
    },
    "/v1/models": unavailable("no defensible model target; PM10 cannot calibrate LST.", {
      viability_note: "Fixture: two PM10 stations do not support spatial validation.",
      blockers: ["Fixture blocker: no compatible reference variable."],
    }),
    "/v1/scenarios": unavailable("scenarios need a validated model.", {
      blockers: ["Fixture blocker: no validated model admits interventions."],
    }),
    "/v1/assistant": {
      status: "unavailable",
      reason: "Fixture: Gemini calls are disabled.",
      model: "demo-model",
      budget_usd: 4,
      input_price_usd_per_million_tokens: null,
      output_price_usd_per_million_tokens: null,
      prices_verified: false,
      prices_note: "Fixture: prices are placeholders, not verified official prices.",
      calls_enabled: false,
      key_configured: false,
      spent_usd: 0,
      reserved_usd: 0,
    },
  };
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

/** RGBA PNG with a diagonal hatch, visibly fake when drawn over the map. */
export function hatchPng(size, [r, g, b]) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    const row = y * (size * 4 + 1);
    for (let x = 0; x < size; x++) {
      const on = (x + y) % 16 < 2 || x < 2 || y < 2 || x >= size - 2 || y >= size - 2;
      raw.set([r, g, b, on ? 200 : 0], row + 1 + x * 4);
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header.set([8, 6, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
