"use server";

import { apiBaseUrl } from "../lib/api";
import { buildDistrictFallbackAdvice } from "../lib/municipal-briefing";

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
      ? "Énfasis: prioriza una visita de campo y qué observar en terreno (sombra, materiales, vegetación), sin inventar hallazgos."
      : focus === "datos"
        ? "Énfasis: qué datos conviene sumar al expediente y cómo documentar la evidencia ya publicada."
        : "Énfasis: 3 a 5 acciones concretas para la Alcaldía en este distrito.";

  const seriesHint =
    series.status === "available" && series.items.length > 0
      ? `El cliente ve ${series.items.length} indicador(es) aceptado(s) para este distrito; úsalos y cítalos.`
      : "El cliente no ve serie zonal aceptada para este polígono; cita esa limitación y usa la evidencia piloto solo como contexto de ciudad, no como media del distrito.";

  const fallbackAdvice = buildDistrictFallbackAdvice({
    districtName: name,
    districtNumber: number,
    series,
    weather: parseWeatherNote(weatherNote),
    focus,
  });

  const question = [
    `Apoyo técnico para la Alcaldía de Cochabamba · microclima del distrito «${name}» (n.º ${number}).`,
    `Versión territorial: ${version}. Fuente del límite en servidor: ${sourceUrl}.`,
    "Obligatorio: entrega siempre una respuesta útil con la estructura pedida. Prohibido responder solo «no hay datos suficientes».",
    focusLine,
    seriesHint,
    "Estructura exacta:",
    "1) Lectura de lo disponible (LST/superficie vs aire; si no hay serie distrital, dilo en una frase y pasa al contexto piloto de ciudad).",
    "2) Qué puede hacer la Alcaldía AHORA en este distrito: 3 a 5 bullets accionables (visita, inventario sombra/arbolado, comparar con otro distrito, expediente con cobertura, agenda según clima modelado de hoy si aplica).",
    "3) Límites: qué no se puede afirmar todavía.",
    "4) Próximo dato útil (uno o dos), sin bloquear las acciones del punto 2.",
    "Cita al menos un [En]. No inventes cifras ni °C de enfriamiento. No trates la media piloto como media del polígono.",
    weatherNote
      ? `Contexto operativo modelado Open‑Meteo (no es Landsat ni sensor distrital); puedes usarlo solo para agenda de campo: ${weatherNote}`
      : "Sin contexto meteorológico modelado en esta consulta.",
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
          : "El asistente no pudo responder. Se muestra orientación local con los datos disponibles.";
      return {
        answer: fallbackAdvice,
        message: detail,
        status: "http_error",
      };
    }
    if (!result || typeof result.status !== "string") {
      return {
        answer: fallbackAdvice,
        message: "Respuesta del asistente no válida. Orientación local con datos disponibles.",
        status: "invalid",
      };
    }
    if (result.status !== "answered" || typeof result.answer !== "string") {
      return {
        answer: fallbackAdvice,
        message:
          typeof result.reason === "string"
            ? `${result.reason} Se muestra orientación local con la evidencia ya cargada.`
            : "Sin texto IA verificable. Orientación local con la evidencia ya cargada.",
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
    let answer = result.answer.slice(0, 12000);
    // If the model only refuses for lack of data, replace with actionable local advice.
    if (/no hay datos suficientes|evidencia no basta|sin datos suficientes|datos insuficientes/i.test(answer)
      && answer.length < 900) {
      answer = fallbackAdvice;
    }
    return {
      answer,
      message:
        "Sugerencias para la Alcaldía con la evidencia disponible de este distrito. Orientación técnica, no decisión automática.",
      status: "answered",
      spent_usd: spent,
      model: typeof result.model === "string" ? result.model : null,
      citations,
    };
  } catch {
    return {
      answer: fallbackAdvice,
      message: "El asistente no respondió a tiempo. Orientación local con los datos disponibles.",
      status: "timeout",
    };
  }
}

function parseWeatherNote(note: string) {
  if (!note.trim()) return null;
  const temperature = Number(/aire\s+(-?\d+(?:\.\d+)?)/i.exec(note)?.[1]);
  const apparent = Number(/sensaci[oó]n\s+(-?\d+(?:\.\d+)?)/i.exec(note)?.[1]);
  const humidity = Number(/humedad\s+(\d+(?:\.\d+)?)/i.exec(note)?.[1]);
  const wind = Number(/viento\s+(\d+(?:\.\d+)?)/i.exec(note)?.[1]);
  const rain = Number(/lluvia\s+(\d+(?:\.\d+)?)/i.exec(note)?.[1]);
  if (![temperature, apparent, humidity, wind, rain].every((value) => Number.isFinite(value))) {
    return null;
  }
  return { temperature, apparent, humidity, wind, rain };
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
