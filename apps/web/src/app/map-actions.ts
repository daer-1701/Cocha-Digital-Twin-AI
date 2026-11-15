"use server";

import { apiBaseUrl } from "../lib/api";

export type DistrictIndicatorRow = {
  variable: string;
  statistic: string;
  value: number | null;
  units: string | null;
  period_start: string;
  period_end: string;
  valid_fraction: number | null;
  n: number | null;
  provenance: Record<string, unknown> | null;
};

export type DistrictSeriesResult =
  | {
      status: "available" | "empty" | "unavailable";
      reason: string;
      items: DistrictIndicatorRow[];
    }
  | { status: "error"; reason: string; items: [] };

export type WeatherReading = {
  time: string;
  temperature: number;
  humidity: number;
  apparent: number;
  rain: number;
  wind: number;
  latitude: number;
  longitude: number;
  scope: "city_point" | "district_centroid";
};

export type ExplainResult = {
  answer: string | null;
  message: string;
  status?: string;
  spent_usd?: number | null;
  model?: string | null;
  citations?: { id: string; title: string; source: string }[];
};

function assistantHeaders(): HeadersInit | null {
  const token = process.env.API_ASSISTANT_TOKEN;
  if (!token?.trim()) return null;
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

/** Open-Meteo for a validated WGS84 point. Same model cell may serve neighbouring districts. */
export async function loadMapWeather(point?: {
  latitude: number;
  longitude: number;
  scope?: "city_point" | "district_centroid";
}): Promise<WeatherReading | null> {
  const latitude = point?.latitude ?? -17.3895;
  const longitude = point?.longitude ?? -66.1568;
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return null;
  }
  try {
    const url =
      "https://api.open-meteo.com/v1/forecast?" +
      new URLSearchParams({
        latitude: latitude.toFixed(4),
        longitude: longitude.toFixed(4),
        current:
          "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,wind_speed_10m",
        timezone: "America/La_Paz",
        forecast_days: "1",
      });
    const response = await fetch(url, {
      next: { revalidate: 600 },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return null;
    const body = await response.json();
    const current = body?.current;
    const fields = [
      "temperature_2m",
      "relative_humidity_2m",
      "apparent_temperature",
      "precipitation",
      "wind_speed_10m",
    ] as const;
    if (
      !current ||
      typeof current.time !== "string" ||
      !fields.every(
        (key) => typeof current[key] === "number" && Number.isFinite(current[key]),
      )
    ) {
      return null;
    }
    return {
      time: current.time as string,
      temperature: current.temperature_2m as number,
      humidity: current.relative_humidity_2m as number,
      apparent: current.apparent_temperature as number,
      rain: current.precipitation as number,
      wind: current.wind_speed_10m as number,
      latitude,
      longitude,
      scope: point?.scope ?? "city_point",
    };
  } catch {
    return null;
  }
}

/** Accepted official series only. Pilot Landsat means are never returned as district metrics. */
export async function loadDistrictIndicators(input: {
  districtNumber: number;
  boundaryVersion: string;
}): Promise<DistrictSeriesResult> {
  const number = Number(input.districtNumber);
  const version = String(input.boundaryVersion ?? "").trim();
  if (!Number.isInteger(number) || number < 1 || number > 15 || !version) {
    return { status: "error", reason: "Parámetros de distrito inválidos.", items: [] };
  }
  try {
    const query = new URLSearchParams({
      limit: "50",
      offset: "0",
      district_number: String(number),
      boundary_version: version,
    });
    const response = await fetch(`${apiBaseUrl()}/v1/series?${query}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) {
      return {
        status: "error",
        reason: "No se pudo consultar la serie oficial del distrito.",
        items: [],
      };
    }
    const body = await response.json();
    if (
      !body ||
      typeof body.status !== "string" ||
      !["available", "empty", "unavailable"].includes(body.status)
    ) {
      return { status: "error", reason: "Respuesta de serie no válida.", items: [] };
    }
    const official = Array.isArray(body.official_items) ? body.official_items : [];
    const items: DistrictIndicatorRow[] = official
      .filter(
        (row: Record<string, unknown>) =>
          row &&
          Number(row.district_number) === number &&
          row.boundary_version === version &&
          row.publication_status === "accepted",
      )
      .map((row: Record<string, unknown>) => ({
        variable: String(row.variable ?? ""),
        statistic: String(row.statistic ?? ""),
        value: typeof row.value === "number" ? row.value : null,
        units: typeof row.units === "string" ? row.units : null,
        period_start: String(row.period_start ?? ""),
        period_end: String(row.period_end ?? ""),
        valid_fraction:
          typeof row.valid_fraction === "number" ? row.valid_fraction : null,
        n: typeof row.n === "number" ? row.n : null,
        provenance:
          row.provenance && typeof row.provenance === "object"
            ? (row.provenance as Record<string, unknown>)
            : null,
      }));
    return {
      status: body.status,
      reason:
        typeof body.reason === "string"
          ? body.reason
          : "Serie oficial consultada en el servidor.",
      items,
    };
  } catch {
    return {
      status: "error",
      reason: "Tiempo de espera o error de red al consultar indicadores.",
      items: [],
    };
  }
}

/**
 * Gemini advice for the municipality on one district.
 * Browser sends identity (+ optional labeled weather context); numbers come from the API.
 */
export async function explainDistrictEvidence(input: {
  districtNumber: number;
  boundaryVersion: string;
  weatherNote?: string | null;
  focus?: "acciones" | "visita" | "datos";
}): Promise<ExplainResult> {
  const headers = assistantHeaders();
  if (!headers) {
    return {
      answer: null,
      message:
        "La interpretación generativa no está habilitada en este servidor. La lectura orientativa permanece disponible.",
    };
  }
  const number = Number(input.districtNumber);
  const version = String(input.boundaryVersion ?? "").trim();
  if (!Number.isInteger(number) || number < 1 || number > 15 || !version) {
    return { answer: null, message: "Distrito no válido para interpretación." };
  }

  const series = await loadDistrictIndicators({
    districtNumber: number,
    boundaryVersion: version,
  });
  const districtsResponse = await fetch(
    `${apiBaseUrl()}/v1/territories/districts?boundary_version=${encodeURIComponent(version)}&limit=15`,
    { cache: "no-store", signal: AbortSignal.timeout(12000) },
  ).catch(() => null);
  let name = `Distrito ${number}`;
  let sourceUrl = "no confirmada en esta consulta";
  if (districtsResponse?.ok) {
    const body = await districtsResponse.json().catch(() => null);
    const match = Array.isArray(body?.items)
      ? body.items.find((row: { number?: number }) => row.number === number)
      : null;
    if (match?.name) name = String(match.name);
    if (match?.source_url) sourceUrl = String(match.source_url);
  }

  const weatherNote = String(input.weatherNote ?? "")
    .trim()
    .slice(0, 280);
  const focus = input.focus ?? "acciones";
  const focusLine =
    focus === "visita"
      ? "Énfasis: prioriza si conviene una visita de campo ahora y qué observar en terreno (sombra, materiales, vegetación), sin inventar hallazgos."
      : focus === "datos"
        ? "Énfasis: lista qué datos faltan para decidir con más seguridad y cómo documentarlos en un expediente municipal."
        : "Énfasis: 3 a 5 acciones concretas que la Alcaldía puede hacer en este distrito a partir de la evidencia.";

  const question = [
    `Eres apoyo técnico para la Alcaldía de Cochabamba sobre microclimas urbanos del distrito municipal «${name}» (número ${number}).`,
    `Versión territorial: ${version}. Fuente del límite en servidor: ${sourceUrl}.`,
    "El servidor adjuntará la serie oficial aceptada de este distrito y la evidencia piloto publicada.",
    focusLine,
    "Responde en español con esta estructura exacta:",
    "1) Qué dice la evidencia de microclima aquí (distingue LST/superficie de aire).",
    "2) Qué puede hacer la Alcaldía en este distrito: sugerencias concretas y priorizadas (visitas, inventario de sombra/arbolado, comparación con otro distrito, expediente con cobertura, agenda según clima modelado de hoy si aplica).",
    "3) Qué no se puede afirmar todavía.",
    "4) Qué dato faltaría para decidir con más seguridad.",
    "Reglas: cita identificadores [En]; no inventes cifras ni límites oficiales; no prometas °C de enfriamiento ni causalidad; si la cobertura es baja o no hay serie distrital, dilo y sugiere solo pasos de verificación.",
    "No trates la media de la ventana piloto como medición del polígono completo.",
    weatherNote
      ? `Contexto operativo modelado (Open‑Meteo, no es Landsat ni sensor distrital): ${weatherNote}`
      : "Sin contexto meteorológico modelado adjunto en esta consulta.",
    `Estado de /v1/series visto por el cliente: ${series.status}.`,
  ].join("\n");

  const requestId = `dist-${number}-${Date.now().toString(36)}`;
  try {
    const response = await fetch(`${apiBaseUrl()}/v1/assistant/ask`, {
      method: "POST",
      cache: "no-store",
      signal: AbortSignal.timeout(45000),
      headers,
      body: JSON.stringify({
        request_id: requestId,
        question,
        district_number: number,
        boundary_version: version,
      }),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok) {
      const detail =
        typeof result?.detail === "string"
          ? result.detail
          : "El asistente no pudo responder. Revisa disponibilidad, autorización y cuota.";
      return { answer: null, message: detail, status: "http_error" };
    }
    if (!result || typeof result.status !== "string") {
      return {
        answer: null,
        message: "Respuesta del asistente no válida.",
        status: "invalid",
      };
    }
    if (result.status !== "answered" || typeof result.answer !== "string") {
      return {
        answer: null,
        message:
          typeof result.reason === "string"
            ? result.reason
            : "Sin interpretación IA: el servidor mantuvo sus controles de evidencia, autorización o presupuesto.",
        status: result.status,
        model: typeof result.model === "string" ? result.model : null,
      };
    }
    let spent: number | null = null;
    try {
      const status = await fetch(`${apiBaseUrl()}/v1/assistant`, {
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
      });
      if (status.ok) {
        const body = await status.json();
        if (typeof body.spent_usd === "number") spent = body.spent_usd;
      }
    } catch {
      spent = null;
    }
    const citations = Array.isArray(result.citations)
      ? result.citations
          .filter((c: { id?: string }) => c && typeof c.id === "string")
          .map((c: { id: string; title?: string; source?: string }) => ({
            id: c.id,
            title: typeof c.title === "string" ? c.title : c.id,
            source: typeof c.source === "string" ? c.source : "",
          }))
      : [];
    return {
      answer: result.answer.slice(0, 12000),
      message:
        "Sugerencias IA para la Alcaldía con evidencia del servidor de este distrito. Son orientación técnica, no una decisión automática.",
      status: "answered",
      spent_usd: spent,
      model: typeof result.model === "string" ? result.model : null,
      citations,
    };
  } catch {
    return {
      answer: null,
      message: "El asistente no respondió a tiempo. Puedes reintentar.",
      status: "timeout",
    };
  }
}

/** City-wide fallback used when no district is selected. */
export async function explainMapEvidence(): Promise<ExplainResult> {
  const headers = assistantHeaders();
  if (!headers) {
    return {
      answer: null,
      message:
        "La interpretación generativa no está habilitada en este servidor. La lectura orientativa permanece disponible.",
    };
  }
  try {
    const response = await fetch(`${apiBaseUrl()}/v1/assistant/ask`, {
      method: "POST",
      cache: "no-store",
      signal: AbortSignal.timeout(45000),
      headers,
      body: JSON.stringify({
        request_id: `pilot-${Date.now().toString(36)}`,
        question:
          "Explica en español la evidencia publicada de LST y NDVI para estudiar microclimas urbanos de Cochabamba. Cita las fuentes y fechas disponibles. Distingue superficie de aire y no afirmes mediciones meteorológicas actuales ni tendencias no validadas. No presentes la ventana piloto como estadística por distrito municipal.",
      }),
    });
    if (!response.ok) {
      return {
        answer: null,
        message: "El asistente no pudo responder. Revisa disponibilidad y cuota.",
      };
    }
    const result = await response.json();
    if (result.status !== "answered" || typeof result.answer !== "string") {
      return {
        answer: null,
        message:
          typeof result.reason === "string"
            ? result.reason
            : "Sin interpretación IA disponible: el servidor mantiene sus controles de evidencia, autorización y presupuesto.",
        status: result.status,
      };
    }
    return {
      answer: result.answer.slice(0, 12000),
      message:
        "Interpretación IA de la evidencia publicada del piloto; puede corresponder a otras fechas que la vista seleccionada.",
      status: "answered",
      model: typeof result.model === "string" ? result.model : null,
    };
  } catch {
    return { answer: null, message: "El asistente no respondió a tiempo. Puedes reintentar." };
  }
}
