import "server-only";
import type { components } from "@cocha/shared";

export type Health = components["schemas"]["HealthResponse"];
export type Evidence = components["schemas"]["Snapshot"];
/** "blocked": synthetic fixtures reached a production build and were rejected. */
export type DemoState = "off" | "active" | "blocked";

// Set by apps/web/test/fixtures/server.mjs on every response.
function demoState(response: Response): DemoState {
  if (response.headers.get("x-cocha-data-source") !== "synthetic-fixture")
    return "off";
  const allowed =
    process.env.NODE_ENV !== "production" ||
    process.env.ALLOW_SYNTHETIC_FIXTURES === "1";
  return allowed ? "active" : "blocked";
}

export async function getEvidence(): Promise<{
  data: Evidence | null;
  error: boolean;
  demo: DemoState;
}> {
  let demo: DemoState = "off";
  try {
    const response = await fetch(
      `${process.env.API_INTERNAL_URL ?? "http://localhost:8000"}/v1/explorer`,
      { cache: "no-store", signal: AbortSignal.timeout(5000) },
    );
    demo = demoState(response);
    if (!response.ok || demo === "blocked")
      return { data: null, error: true, demo };
    const result: components["schemas"]["ExplorerResponse"] =
      await response.json();
    return { data: result.evidence ?? null, error: false, demo };
  } catch {
    return { data: null, error: true, demo };
  }
}

export async function getApiHealth(): Promise<Health | null> {
  try {
    const response = await fetch(
      `${process.env.API_INTERNAL_URL ?? "http://localhost:8000"}/health/live`,
      { cache: "no-store", signal: AbortSignal.timeout(3000) },
    );
    if (!response.ok) return null;
    const result: unknown = await response.json();
    if (
      typeof result !== "object" ||
      result === null ||
      !("status" in result) ||
      result.status !== "ok" ||
      !("service" in result) ||
      result.service !== "cocha-api"
    )
      return null;
    return { status: "ok", service: "cocha-api" };
  } catch {
    return null;
  }
}
