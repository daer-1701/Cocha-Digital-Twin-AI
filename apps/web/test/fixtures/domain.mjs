// Synthetic availability envelopes mirroring the honest defaults of services/api.
import { deflateSync, crc32 } from "node:zlib";
import { valleyDomain } from "./valley.mjs";

const BOUNDS = [-66.18, -17.41, -66.14, -17.37];
const PAGE = { limit: 50, offset: 0 };
const GENERATED_AT = "2026-11-14T00:00:00Z";
const round = (value, digits) => Number(value.toFixed(digits));

// Same allowlist as services/api/src/cocha_api/science/gamc_catalog.py.
export const WMS_LAYERS = [
  { name: "Limite Urbano", service_id: "fd77d463-9729-4c66-b686-23dccbb4ab8f" },
  { name: "Cota 2750", service_id: "297cefa4-0832-42bb-a98e-2cbea989fd9d" },
  { name: "Áreas Verdes", service_id: "47360ddc-e35f-4ece-a995-59e90eb79cc6" },
  { name: "Limite Distritos", service_id: "7eb13092-bf0e-493b-aae6-03c43eedda2c" },
  { name: "Población por Manzanas", service_id: "194a02a0-a73a-48c1-a260-82847c5c905d" },
];

const METADATA_PENDING = [
  "timezone of fecha_medicion",
  "station coordinates (lat/lon not in CSV)",
  "measurement QA codes and zero interpretation",
  "data redistribution license",
];

const STATIONS = [
  { source_id: "kanata", name: "DEMO Kanata", described_location: "Ubicación descrita sintética A" },
  { source_id: "semapa", name: "DEMO Semapa", described_location: "Ubicación descrita sintética B" },
];

const fixtureId = (n) => `00000000-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;
// Kanata has paginated records; Semapa was imported without rows.
export const STATION_IDS = { kanata: fixtureId(0x5a01), semapa: fixtureId(0x5a02) };
const OBSERVATIONS_PATH = /^\/v1\/stations\/([^/]+)\/observations$/;
const KANATA_RECORDS = 60;

/** Synthetic processing runs, newest first: 25 rows so /procesamiento needs two pages. */
function jobItems() {
  const kinds = ["monica_pm10_import", "offline_monica_qa", "fixture_unknown_kind"];
  const start = Date.parse("2026-11-01T12:00:00Z");
  return Array.from({ length: 25 }, (_, i) => {
    const started = new Date(start - i * 3_600_000).toISOString();
    const status = i === 0 ? "running" : i === 1 ? "failed" : "completed";
    return {
      id: fixtureId(0x10b00 + i),
      kind: kinds[i % kinds.length],
      status,
      started_at: started,
      finished_at:
        status === "running" ? null : new Date(Date.parse(started) + 600_000).toISOString(),
    };
  });
}

/** Record i of Kanata, newest first; zeros, negatives and missing values stay as imported. */
function kanataRecord(i) {
  const observedAt = new Date(Date.parse("2026-10-03T23:00:00Z") - i * 3_600_000)
    .toISOString()
    .slice(0, 19);
  const [value, flag] =
    i % 11 === 3
      ? [null, "invalid_value"]
      : i % 13 === 4
        ? [0, "zero"]
        : i % 17 === 5
          ? [-2.5, "negative"]
          : [round(30 + ((i * 7) % 23) + 0.25, 2), "valid"];
  return {
    id: fixtureId(0x0b5000 + i),
    observed_at: observedAt,
    value,
    unit: "ug/m3",
    quality_flag: flag,
    processing_run_id: i < 40 ? fixtureId(0x10b02) : null,
  };
}

/**
 * GET /v1/stations/{id}/observations for the `monica` mode of a scenario:
 * "review" serves records, "locked" mirrors MONICA_REVIEW_ENABLED=false.
 * Returns null when the route does not match.
 */
export function stationObservations(monica, pathname, searchParams) {
  const match = OBSERVATIONS_PATH.exec(pathname);
  if (!match) return null;
  const station = Object.entries(STATION_IDS).find(([, id]) => id === match[1]);
  if (!monica || !station) return { status: 404, body: { detail: "Station not found" } };
  const [sourceId, stationId] = station;
  const limit = Number(searchParams.get("limit") ?? 50);
  const offset = Number(searchParams.get("offset") ?? 0);
  const base = {
    station_id: stationId,
    station_name: STATIONS.find((s) => s.source_id === sourceId).name,
    variable: "pm10",
    scope: "imported_records_review",
    analysis_enabled: false,
    timezone: null,
    limit,
    offset,
  };
  if (monica === "locked")
    return {
      status: 200,
      body: {
        ...base,
        status: "unavailable",
        reason: "Fixture: local record review is disabled (MONICA_REVIEW_ENABLED).",
        items: [],
        has_more: false,
      },
    };
  const total = sourceId === "kanata" ? KANATA_RECORDS : 0;
  const end = Math.min(total, offset + limit);
  const items = Array.from({ length: Math.max(0, end - offset) }, (_, k) => kanataRecord(offset + k));
  return {
    status: 200,
    body: {
      ...base,
      status: items.length ? "available" : "empty",
      reason: "Fixture: synthetic imported records for quality review only.",
      items,
      has_more: end < total,
    },
  };
}

/** Same rule as cocha_api.science.trends.descriptive_slope: OLS on the scene index. */
function descriptiveSlope(values, minN = 3) {
  const points = values
    .map((value, index) => [index, value])
    .filter(([, value]) => typeof value === "number");
  const n = points.length;
  if (n < minN) return { n, status: "inconclusive", slope: null };
  const meanX = points.reduce((s, [x]) => s + x, 0) / n;
  const meanY = points.reduce((s, [, y]) => s + y, 0) / n;
  const num = points.reduce((s, [x, y]) => s + (x - meanX) * (y - meanY), 0);
  const den = points.reduce((s, [x]) => s + (x - meanX) ** 2, 0);
  return { n, status: "descriptive", slope: den ? Number((num / den).toFixed(6)) : 0 };
}

function pilotTrends(evidence) {
  if (!evidence) return [];
  return ["lst_mean", "ndvi_mean"].map((variable) => {
    const { n, status, slope } = descriptiveSlope(evidence.scenes.map((s) => s[variable]));
    return {
      variable,
      scope: "pilot_window",
      district_trend: false,
      n_finite: n,
      min_n: 3,
      status,
      slope_per_step: slope,
      method: "descriptive_ols_on_index",
      publishes_inference: false,
      note: "Fixture: descriptive slope on synthetic values; not a district trend or climate inference.",
    };
  });
}

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

/**
 * GET routes outside /v1/explorer. `wms` enables the synthetic GAMC layers;
 * `evidence` is the active scenario snapshot, or null when none is published;
 * `districts` adds demo-rectangle indicators, series and trends;
 * `monica` ("review" | "locked") publishes imported stations and processing runs;
 * `quotaSpent` marks the whole assistant budget as spent.
 */
export function domainRoutes({ wms, evidence, districts = false, sceneId, monica, quotaSpent }) {
  const valley = districts ? valleyDomain(sceneId) : {};
  if (valley["/v1/trends"]) valley["/v1/trends"].pilot_trends = pilotTrends(evidence);
  return {
    "/v1/territories": territories(wms),
    "/v1/jobs": monica
      ? { status: "available", reason: null, items: jobItems(), has_more: false, ...PAGE }
      : {
          status: "empty", reason: "Fixture: no persisted processing runs.",
          items: [], has_more: false, ...PAGE,
        },
    "/v1/indicators": unavailable("district indicators need verified district vectors."),
    "/v1/series": unavailable("district series are not published."),
    "/v1/trends": unavailable("no official trend without comparable district series.", {
      pilot_trends: pilotTrends(evidence),
    }),
    "/v1/reports": evidence
      ? {
          status: "available",
          reason: "Fixture: formal district reports are unavailable; observation_export is the pilot window.",
          items: [],
          ...PAGE,
          observation_export: {
            kind: "observation_export",
            scope: "pilot_window",
            district_report: false,
            note: "Fixture: observation export of the synthetic pilot window. Not a district report.",
            evidence,
          },
        }
      : {
          status: "empty",
          reason: "Fixture: no observation snapshot is published for export.",
          items: [],
          ...PAGE,
          observation_export: null,
        },
    "/v1/stations": {
      status: monica ? "available" : "empty",
      reason: monica
        ? "Fixture: synthetic imported stations; analysis aggregates disabled."
        : "Fixture: no MONICA stations imported yet; analysis aggregates disabled.",
      items: STATIONS.map((station) => ({
        ...(monica ? { id: STATION_IDS[station.source_id] } : {}),
        ...station,
        variable: "pm10",
        unit: "ug/m3",
        unit_source: "https://example.org/fixture-unit-source.pdf",
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
      // The "wms" scenario also exercises the verified-prices view, with placeholder numbers.
      ...(wms
        ? {
            input_price_usd_per_million_tokens: 1,
            output_price_usd_per_million_tokens: 2,
            prices_verified: true,
            prices_verified_on: "2026-01-01",
            prices_source_url: "https://example.org/fixture-pricing",
            prices_note: "Fixture: placeholder prices marked as verified for UI tests only.",
          }
        : {
            input_price_usd_per_million_tokens: null,
            output_price_usd_per_million_tokens: null,
            prices_verified: false,
            prices_verified_on: null,
            prices_source_url: null,
            prices_note: "Fixture: prices are placeholders, not verified official prices.",
          }),
      calls_enabled: false,
      key_configured: false,
      spent_usd: quotaSpent ? 4 : 0,
      reserved_usd: 0,
    },
    ...valley,
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
