import type { DistrictIndicatorRow, WeatherReading } from "../app/map-actions";

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

function coveragePct(row: DistrictIndicatorRow): number | null {
  if (row.valid_fraction == null || !Number.isFinite(row.valid_fraction)) return null;
  return Math.round(row.valid_fraction * 100);
}

function lstCard(row: DistrictIndicatorRow): BriefCard {
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

function ndviCard(row: DistrictIndicatorRow): BriefCard {
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

export function briefCardsFromSeries(items: DistrictIndicatorRow[]): BriefCard[] {
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
  weather: WeatherReading | null;
}): string[] {
  const steps: string[] = [];
  if (!input.hasIndicators) {
    steps.push(
      "Este distrito aún no tiene medias zonales aceptadas: no inventes un ranking. Usa el mapa para ubicar el polígono y pide la serie oficial.",
    );
    steps.push("Compara con otro distrito que sí tenga indicadores, o revisa el análisis 2014–2025 del piloto.");
  } else if (input.weakCoverage) {
    steps.push("Marca este distrito como «evidencia incompleta» hasta mejorar cobertura o sumar visitas de campo.");
    steps.push("Descarga la ficha para el expediente y documenta el % de cobertura válida.");
  } else {
    steps.push("Usa LST y NDVI juntos: superficie caliente + poco verdor relativo = candidato a visita técnica, no a conclusión automática.");
    steps.push("Compara este distrito con otro bajo la misma versión territorial antes de priorizar intervención.");
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
