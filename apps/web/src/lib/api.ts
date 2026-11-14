import "server-only";
import type { components } from "@cocha/shared";

export type Health = components["schemas"]["HealthResponse"];

export async function getApiHealth(): Promise<Health | null> {
  try {
    const response = await fetch(
      `${process.env.API_INTERNAL_URL ?? "http://localhost:8000"}/health/live`,
      { cache: "no-store", signal: AbortSignal.timeout(3000) },
    );
    if (!response.ok) return null;
    const result: unknown = await response.json();
    if (
      typeof result !== "object" || result === null ||
      !("status" in result) || result.status !== "ok" ||
      !("service" in result) || result.service !== "cocha-api"
    ) return null;
    return { status: "ok", service: "cocha-api" };
  } catch {
    return null;
  }
}
