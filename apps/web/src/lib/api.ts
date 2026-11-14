import "server-only";
import type { components } from "@cocha/shared";

type Schemas = components["schemas"];
export type Health = Schemas["HealthResponse"];
export type Evidence = Schemas["Snapshot"];
export type Territories = Schemas["TerritoriesResponse"];
export type Stations = Schemas["StationsResponse"];
export type Series = Schemas["SeriesResponse"];
export type Trends = Schemas["TrendsResponse"];
export type Indicators = Schemas["IndicatorsResponse"];
export type Models = Schemas["ModelsResponse"];
export type Scenarios = Schemas["ScenariosResponse"];
export type AssistantStatus = Schemas["AssistantStatusResponse"];
export type Reports = Schemas["ReportsResponse"];
export type ObservationExport = Schemas["ObservationExport"];
export type PilotTrend = Schemas["PilotTrendItem"];
export type Jobs = Schemas["JobsResponse"];
export type StationObservations = Schemas["StationObservationsResponse"];
/** "blocked": synthetic fixtures reached a production build and were rejected. */
export type DemoState = "off" | "active" | "blocked";
export type ApiResult<T> = { data: T | null; error: boolean; demo: DemoState };

const AVAILABILITY = ["available", "empty", "unavailable"];

export function apiBaseUrl(): string {
  return process.env.API_INTERNAL_URL ?? "http://localhost:8000";
}

// Set by apps/web/test/fixtures/server.mjs on every response.
export function demoState(response: Response): DemoState {
  if (response.headers.get("x-cocha-data-source") !== "synthetic-fixture")
    return "off";
  const allowed =
    process.env.NODE_ENV !== "production" ||
    process.env.ALLOW_SYNTHETIC_FIXTURES === "1";
  return allowed ? "active" : "blocked";
}

/** A page is demo if any of its responses came from the fixtures. */
export function mergeDemo(...states: DemoState[]): DemoState {
  if (states.includes("blocked")) return "blocked";
  return states.includes("active") ? "active" : "off";
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Shape check at the boundary: the generated types are not a runtime guarantee. */
function isEnvelope(value: unknown, statuses = AVAILABILITY): boolean {
  return (
    isObject(value) &&
    typeof value.status === "string" &&
    statuses.includes(value.status) &&
    (value.reason === undefined ||
      value.reason === null ||
      typeof value.reason === "string")
  );
}

const hasArray = (value: unknown, key: string) =>
  isObject(value) && (value[key] === undefined || Array.isArray(value[key]));

async function getJson<T>(
  path: string,
  isValid: (value: unknown) => boolean,
  timeoutMs = 5000,
  headers?: HeadersInit,
): Promise<ApiResult<T>> {
  let demo: DemoState = "off";
  try {
    const response = await fetch(`${apiBaseUrl()}${path}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
      headers,
    });
    demo = demoState(response);
    if (!response.ok || demo === "blocked") return { data: null, error: true, demo };
    const body: unknown = await response.json();
    if (!isValid(body)) return { data: null, error: true, demo };
    return { data: body as T, error: false, demo };
  } catch {
    return { data: null, error: true, demo };
  }
}

export async function getEvidence(): Promise<ApiResult<Evidence>> {
  const result = await getJson<Schemas["ExplorerResponse"]>(
    "/v1/explorer",
    (body) =>
      isEnvelope(body, ["available", "empty"]) &&
      isObject(body) &&
      (body.evidence == null || isObject(body.evidence)),
  );
  return { ...result, data: result.data?.evidence ?? null };
}

export const getTerritories = () =>
  getJson<Territories>(
    "/v1/territories",
    (body) =>
      isEnvelope(body) &&
      isObject(body) &&
      isObject(body.pilot) &&
      Array.isArray(body.wms_layers) &&
      isObject(body.vector_districts),
  );

export const getStations = () =>
  getJson<Stations>("/v1/stations", (b) => isEnvelope(b) && hasArray(b, "items"));
export const getJobs = (offset = 0) =>
  getJson<Jobs>(`/v1/jobs?limit=20&offset=${offset}`,
    (b) => isEnvelope(b) && isObject(b) && Array.isArray(b.items));
// Server-only secret: whoever can open this page sees the records it unlocks.
const reviewerHeaders = (): HeadersInit | undefined => {
  const token = process.env.API_REVIEWER_TOKEN;
  return token ? { Authorization: `Bearer ${token}` } : undefined;
};
export const getStationObservations = (id: string, offset = 0) =>
  getJson<StationObservations>(`/v1/stations/${encodeURIComponent(id)}/observations?limit=50&offset=${offset}`,
    (b) => isEnvelope(b) && isObject(b) && Array.isArray(b.items) &&
      b.scope === "imported_records_review" && b.analysis_enabled === false,
    5000, reviewerHeaders());
export const getSeries = () =>
  getJson<Series>("/v1/series", (b) => isEnvelope(b) && hasArray(b, "items"));
export const getTrends = () =>
  getJson<Trends>(
    "/v1/trends",
    (b) => isEnvelope(b) && hasArray(b, "items") && hasArray(b, "pilot_trends"),
  );
export const getReports = () =>
  getJson<Reports>(
    "/v1/reports",
    (b) =>
      isEnvelope(b) &&
      isObject(b) &&
      (b.observation_export == null ||
        (isObject(b.observation_export) &&
          b.observation_export.district_report === false &&
          isObject(b.observation_export.evidence) &&
          Array.isArray(b.observation_export.evidence.scenes))),
  );
export const getIndicators = (sceneId?: string) => {
  // One scene has at most 15 rectangles × 2 variables, within this page size.
  const query = new URLSearchParams({ limit: "100" });
  if (sceneId) query.set("scene_id", sceneId);
  return getJson<Indicators>(`/v1/indicators?${query}`, (b) =>
    isEnvelope(b) && hasArray(b, "items"),
  );
};
export const getModels = () =>
  getJson<Models>(
    "/v1/models",
    (b) => isEnvelope(b) && hasArray(b, "items") && hasArray(b, "blockers"),
  );
export const getScenarios = () =>
  getJson<Scenarios>(
    "/v1/scenarios",
    (b) => isEnvelope(b) && hasArray(b, "items") && hasArray(b, "blockers"),
  );
export const getAssistantStatus = () =>
  getJson<AssistantStatus>(
    "/v1/assistant",
    (b) =>
      isEnvelope(b, ["unavailable"]) &&
      isObject(b) &&
      typeof b.budget_usd === "number" &&
      typeof b.spent_usd === "number" &&
      typeof b.reserved_usd === "number",
  );

export async function getApiHealth(): Promise<Health | null> {
  const result = await getJson<Health>(
    "/health/live",
    (body) =>
      isObject(body) && body.status === "ok" && body.service === "cocha-api",
    3000,
  );
  return result.data ? { status: "ok", service: "cocha-api" } : null;
}
