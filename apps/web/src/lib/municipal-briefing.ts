export type BriefIndicator = {
  variable: string;
  statistic: string;
  value: number | null;
  units: string | null;
  period_start: string;
  period_end: string;
  valid_fraction: number | null;
  n: number | null;
};

export type BriefWeather = {
  temperature: number;
  humidity: number;
  apparent: number;
  rain: number;
  wind: number;
};

export type BriefCard = {
  id: string;
  title: string;
  value: string;
  meaning: string;
  useFor: string;
  caution: string;
  coveragePct: number | null;
  period: string;
};

function formatPeriod(start: string, end: string): string {
  const a = start.slice(0, 10);
  const b = end.slice(0, 10);
  if (!a && !b) return "Período no indicado";
  if (a === b) return a;
  return `${a} → ${b}`;
}

function coveragePct(row: BriefIndicator): number | null {
  if (row.valid_fraction == null || !Number.isFinite(row.valid_fraction)) return null;
  return Math.round(row.valid_fraction * 100);
}

function lstCard(row: BriefIndicator): BriefCard {
  const coverage = coveragePct(row);
  const value =
    row.value == null || !Number.isFinite(row.value)
      ? "Sin dato"
      : `${row.value.toFixed(1)} ${row.units ?? "°C"}`.trim();
  const weak = coverage != null && coverage < 50;
  return {
    id: `lst-${row.period_start}-${row.period_end}`,
    title: "Calor de superficie (LST)",
    value,
    meaning:
      "Temperatura media de techos, calles y suelo vista por satélite en este polígono. No es la temperatura del aire que siente la gente.",
    useFor: weak
      ? "Todavía no alcanza para priorizar obras: la cobertura válida es baja. Sirve para pedir más escenas o revisar el polígono."
      : "Útil para priorizar dónde inventariar sombra, arbolado o materiales de cubierta, y para comparar distritos con el mismo método.",
    caution:
      "No demuestra que un distrito sea «más caluroso para vivir» ni que plantar árboles baje X grados. Es evidencia de superficie, no de confort térmico.",
    coveragePct: coverage,
    period: formatPeriod(row.period_start, row.period_end),
  };
}

function ndviCard(row: BriefIndicator): BriefCard {
  const coverage = coveragePct(row);
  const value =
    row.value == null || !Number.isFinite(row.value) ? "Sin dato" : row.value.toFixed(3);
  const weak = coverage != null && coverage < 50;
  return {
    id: `ndvi-${row.period_start}-${row.period_end}`,
    title: "Verdor relativo (NDVI)",
    value,
    meaning:
      "Índice de vegetación del polígono. Valores más altos suelen indicar más verdor relativo en la imagen; no mide metros cuadrados de parque.",
    useFor: weak
      ? "Con cobertura baja, no uses este número solo para decidir áreas verdes. Combínalo con catastro o visita de campo."
      : "Útil para comparar cobertura vegetal entre distritos y señalar dónde conviene verificar inventario verde en terreno.",
    caution:
      "NDVI alto no prueba enfriamiento ni calidad de espacio público. No sustituye un censo de árboles ni un plan de riego.",
    coveragePct: coverage,
    period: formatPeriod(row.period_start, row.period_end),
  };
}

export function briefCardsFromSeries(items: BriefIndicator[]): BriefCard[] {
  const cards: BriefCard[] = [];
  for (const row of items) {
    const key = row.variable.toLowerCase();
    if (key.includes("lst")) cards.push(lstCard(row));
    else if (key.includes("ndvi")) cards.push(ndviCard(row));
    else {
      cards.push({
        id: `${row.variable}-${row.period_start}`,
        title: row.variable,
        value:
          row.value == null
            ? "Sin dato"
            : `${row.value} ${row.units ?? ""}`.trim(),
        meaning: "Indicador publicado por el servidor con su unidad y período.",
        useFor: "Revisa fuente, cobertura y método antes de usarlo en un informe municipal.",
        caution: "Sin lectura municipal específica para esta variable todavía.",
        coveragePct: coveragePct(row),
        period: formatPeriod(row.period_start, row.period_end),
      });
    }
  }
  return cards;
}

export function municipalNextSteps(input: {
  hasIndicators: boolean;
  weakCoverage: boolean;
  weather: BriefWeather | null;
}): string[] {
  const steps: string[] = [];
  if (!input.hasIndicators) {
    steps.push(
      "Agenda una visita corta al polígono: anotar sombra en veredas, tipo de cubierta y arbolado visible.",
    );
    steps.push(
      "Compara visualmente este distrito con otro en el mapa y abre Comparar distritos cuando haya serie aceptada.",
    );
    steps.push(
      "Usa el análisis 2014–2025 del piloto como contexto de ciudad (no como media de este polígono).",
    );
  } else if (input.weakCoverage) {
    steps.push(
      "Haz visita de campo priorizando zonas pavimentadas/poco sombra y documenta cobertura válida en el expediente.",
    );
    steps.push("Compara este distrito con otro de la misma versión territorial antes de priorizar obra.");
  } else {
    steps.push(
      "Cruza LST y NDVI: superficie caliente + verdor relativo bajo → candidato a visita técnica e inventario de sombra.",
    );
    steps.push("Compara con otro distrito bajo la misma versión territorial y deja constancia en Informes.");
  }
  if (input.weather) {
    if (input.weather.rain > 0.2) {
      steps.push(
        `Hoy el modelo indica lluvia cerca del centroide (${input.weather.rain.toFixed(1)} mm): agenda de campo con precaución; no confundas esto con la fecha Landsat.`,
      );
    } else if (input.weather.wind >= 25) {
      steps.push(
        `Viento modelado alto (~${input.weather.wind.toFixed(0)} km/h): útil para planificar la visita de hoy, no para reinterpretar el LST histórico.`,
      );
    } else {
      steps.push(
        "El microclima del panel es aire modelado (Open‑Meteo) para contexto operativo de hoy; no calibra ni reemplaza el LST.",
      );
    }
  }
  steps.push("Para un informe municipal: exporta en Informes con fuente, período y limitaciones visibles.");
  return steps.slice(0, 4);
}

/** Local advice when Gemini is unavailable or refuses; always returns actionable text. */
export function buildDistrictFallbackAdvice(input: {
  districtName: string;
  districtNumber: number;
  series: {
    status: string;
    items: BriefIndicator[];
    reason?: string;
  };
  weather: BriefWeather | null;
  focus?: "acciones" | "visita" | "datos";
}): string {
  const cards = briefCardsFromSeries(input.series.items ?? []);
  const weakCoverage = cards.some(
    (card) => card.coveragePct != null && card.coveragePct < 50,
  );
  const steps = municipalNextSteps({
    hasIndicators: cards.length > 0,
    weakCoverage,
    weather: input.weather,
  });
  const focus = input.focus ?? "acciones";
  const lines: string[] = [
    `1) Lectura disponible · ${input.districtName} (distrito ${input.districtNumber})`,
  ];
  if (cards.length === 0) {
    lines.push(
      `Aún no hay serie zonal aceptada para este polígono${
        input.series.reason ? ` (${input.series.reason})` : ""
      }. Se puede trabajar con el mapa oficial, el clima modelado de hoy y la evidencia piloto solo como contexto de ciudad.`,
    );
  } else {
    for (const card of cards.slice(0, 4)) {
      lines.push(
        `• ${card.title}: ${card.value} (${card.period}` +
          `${card.coveragePct != null ? `, cobertura ${card.coveragePct}%` : ""}). ${card.useFor}`,
      );
    }
  }
  lines.push("");
  lines.push(
    focus === "visita"
      ? "2) Prioridad de visita de campo"
      : focus === "datos"
        ? "2) Datos y expediente"
        : "2) Qué puede hacer la Alcaldía ahora",
  );
  for (const step of steps) {
    lines.push(`• ${step}`);
  }
  lines.push("");
  lines.push("3) Límites");
  lines.push(
    "• No se afirma temperatura del aire ni efecto garantizado de arbolado a partir de LST/NDVI solos.",
  );
  lines.push("");
  lines.push("4) Próximo dato útil");
  lines.push(
    cards.length === 0
      ? "• Publicar o aceptar la serie zonal oficial de este distrito con cobertura documentada."
      : "• Una visita georreferenciada (sombra/cubiertas) y, si aplica, comparar con otro distrito en la misma versión territorial.",
  );
  return lines.join("\n");
}

export const MUNICIPAL_PURPOSE = {
  title: "Microclimas urbanos con inteligencia artificial",
  summary:
    "El tema del prototipo es entender microclimas de Cochabamba por distrito oficial: evidencia de superficie (LST/NDVI), clima modelado de aire cerca del centroide, e IA que explica esa evidencia sin inventar cifras. Para la Alcaldía: priorizar dónde mirar, comparar con el mismo método y documentar límites.",
  helps: [
    "La IA sugiere qué puede hacer la Alcaldía en cada distrito (visitas, inventario, expediente)",
    "Cruzar superficie Landsat + aire modelado + evidencia citada por el asistente",
    "Separar lo afirmable de lo que aún falta medir",
  ],
  doesNot: [
    "La IA no inventa mediciones ni convierte LST en temperatura del aire",
    "El clima de hoy (Open‑Meteo) no es la fecha histórica Landsat",
    "No decide sola una obra ni calcula cuántos árboles «enfrían» X grados",
  ],
};
