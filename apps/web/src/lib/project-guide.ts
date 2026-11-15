export type GuideAction = {
  id: string;
  label: string;
  href?: string;
  intent?: "pick-district" | "climate" | "asistente" | "comparar" | "analisis" | "informes";
};

export type GuideHit = {
  id: string;
  title: string;
  answer: string;
  score: number;
  suggestions: GuideAction[];
};

const ACTIONS = {
  pick: {
    id: "pick-district",
    label: "Elegir un distrito en el mapa",
    intent: "pick-district" as const,
  },
  climate: {
    id: "climate",
    label: "Ver microclima modelado",
    intent: "climate" as const,
  },
  asistente: {
    id: "asistente",
    label: "Abrir el asistente científico",
    href: "/asistente",
    intent: "asistente" as const,
  },
  comparar: {
    id: "comparar",
    label: "Comparar distritos",
    href: "/comparar",
    intent: "comparar" as const,
  },
  analisis: {
    id: "analisis",
    label: "Ver análisis 2014–2025",
    href: "/analisis",
    intent: "analisis" as const,
  },
  informes: {
    id: "informes",
    label: "Descargar datos",
    href: "/informes",
    intent: "informes" as const,
  },
};

const ENTRIES: Omit<GuideHit, "score">[] = [
  {
    id: "start",
    title: "Qué puedes hacer aquí",
    answer:
      "Este explorador muestra límites oficiales GAMC y, cuando existen, medias zonales aceptadas de LST (temperatura de superficie) y NDVI (vegetación). Elige un distrito, revisa su ficha, mira el microclima modelado (aire, no LST) y pide una interpretación con evidencia si la IA está habilitada.",
    suggestions: [ACTIONS.pick, ACTIONS.climate, ACTIONS.comparar, ACTIONS.analisis],
  },
  {
    id: "lst",
    title: "Qué es LST",
    answer:
      "LST es la temperatura de la superficie terrestre estimada con Landsat, en °C. No es la temperatura del aire que sientes. Sirve para comparar superficies urbanas (asfalto, techos, vegetación), no para decir «hace X grados en el distrito».",
    suggestions: [ACTIONS.pick, ACTIONS.analisis, ACTIONS.asistente],
  },
  {
    id: "ndvi",
    title: "Qué es NDVI",
    answer:
      "NDVI resume el verdor relativo de la vegetación (sin unidad física). Valores más altos suelen indicar más vegetación fotosintéticamente activa; no demuestran por sí solos un efecto de enfriamiento.",
    suggestions: [ACTIONS.pick, ACTIONS.analisis],
  },
  {
    id: "districts",
    title: "Cómo usar los distritos",
    answer:
      "Busca un distrito por nombre arriba, o pulsa su polígono en el mapa. La ficha solo muestra indicadores si hay filas aceptadas en la API para ese polígono y versión territorial. La media del piloto Landsat no se presenta como medición del distrito completo.",
    suggestions: [ACTIONS.pick, ACTIONS.comparar, ACTIONS.climate],
  },
  {
    id: "climate",
    title: "Microclima en el mapa",
    answer:
      "Al seleccionar un distrito, Open‑Meteo aporta una estimación de aire, humedad, viento y lluvia cerca del centroide. Es un modelo meteorológico, no un sensor distrital ni la fecha Landsat. Las animaciones son efectos visuales orientativos según esa lectura.",
    suggestions: [ACTIONS.pick, ACTIONS.climate],
  },
  {
    id: "ai",
    title: "Asistente e interpretación",
    answer:
      "La IA explica evidencia ya publicada en el servidor; no inventa cifras ni convierte correlación en causalidad. Consume presupuesto Gemini limitado. Puedes preguntar aquí o en /asistente; si no hay cuota o token, verás un estado honesto.",
    suggestions: [ACTIONS.asistente, ACTIONS.pick],
  },
  {
    id: "limits",
    title: "Límites de la evidencia",
    answer:
      "Falta de dato es un estado válido. Cobertura baja, nulos o series vacías no se rellenan con ceros. Distingue observación Landsat, estimación meteorológica y escenario hipotético. Las tendencias y modelos ML solo aparecen si el backend las publica como disponibles.",
    suggestions: [ACTIONS.analisis, ACTIONS.informes, ACTIONS.asistente],
  },
  {
    id: "download",
    title: "Descargas e informes",
    answer:
      "En Informes puedes exportar observaciones del área de estudio con fuente, unidades y período. No descarga colecciones satelitales completas desde el navegador.",
    suggestions: [ACTIONS.informes, ACTIONS.analisis],
  },
];

function normalize(text: string) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es")
    .trim();
}

const KEYWORDS: Record<string, string[]> = {
  start: [
    "que puedo",
    "que hago",
    "como empiezo",
    "ayuda",
    "suger",
    "recomiend",
    "guia",
    "empezar",
    "tourorial",
  ],
  lst: ["lst", "temperatura superficial", "superficie", "calor urbano", "isla de calor"],
  ndvi: ["ndvi", "vegetacion", "verdor", "verde"],
  districts: ["distrito", "poligono", "gamc", "limite", "buscar distrito", "seleccionar"],
  climate: ["microclima", "clima", "lluvia", "viento", "open-meteo", "open meteo", "aire"],
  ai: ["ia", "gemini", "asistente", "interpret", "pregunt"],
  limits: ["limite", "incertidumbre", "causal", "falta de dato", "cobertura"],
  download: ["descarg", "csv", "json", "informe", "export"],
};

export function defaultGuideSuggestions(): GuideAction[] {
  return [ACTIONS.pick, ACTIONS.climate, ACTIONS.comparar, ACTIONS.analisis, ACTIONS.asistente];
}

export function matchProjectGuide(query: string): GuideHit[] {
  const q = normalize(query);
  if (!q) {
    return ENTRIES.filter((entry) => entry.id === "start").map((entry) => ({
      ...entry,
      score: 1,
    }));
  }

  const scored = ENTRIES.map((entry) => {
    let score = 0;
    const hay = normalize(`${entry.title} ${entry.answer}`);
    if (hay.includes(q)) score += 4;
    for (const word of q.split(/\s+/).filter((part) => part.length > 2)) {
      if (hay.includes(word)) score += 1;
    }
    for (const keyword of KEYWORDS[entry.id] ?? []) {
      if (q.includes(normalize(keyword))) score += 3;
    }
    return { ...entry, score };
  })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) {
    return [
      {
        id: "fallback",
        title: "Sin coincidencia directa",
        answer:
          "No encontré una respuesta local exacta. Prueba «qué puedo hacer», «LST», «distritos» o «microclima». Si necesitas una explicación con evidencia publicada, usa «Preguntar a la IA» (consume cuota).",
        score: 0,
        suggestions: defaultGuideSuggestions(),
      },
    ];
  }
  return scored.slice(0, 3);
}

export function humanVariable(variable: string): { label: string; gloss: string } {
  const key = variable.toLowerCase();
  if (key.includes("lst")) {
    return {
      label: "Temperatura de superficie (LST)",
      gloss: "Calor relativo de techos, calles y suelo visto por satélite. No es temperatura del aire.",
    };
  }
  if (key.includes("ndvi")) {
    return {
      label: "Verdor relativo (NDVI)",
      gloss: "Índice de vegetación. Valores más altos suelen indicar más verdor; no prueban causalidad térmica.",
    };
  }
  return {
    label: variable,
    gloss: "Indicador publicado por el servidor con su unidad y período.",
  };
}

export function humanStatistic(statistic: string): string {
  if (statistic.includes("area_weighted_mean")) {
    return "Media ponderada por área (QA compartida)";
  }
  if (statistic.includes("mean")) return "Media";
  return statistic;
}

export function formatPeriod(start: string, end: string): string {
  const a = start.slice(0, 10);
  const b = end.slice(0, 10);
  if (!a && !b) return "Período no indicado";
  if (a === b) return a;
  return `${a} → ${b}`;
}

export function formatIndicatorValue(
  value: number | null,
  units: string | null,
  variable: string,
): string {
  if (value == null || !Number.isFinite(value)) return "Sin dato";
  const key = variable.toLowerCase();
  if (key.includes("lst")) return `${value.toFixed(1)} ${units ?? "°C"}`.trim();
  if (key.includes("ndvi")) return value.toFixed(3);
  return units ? `${value} ${units}` : String(value);
}
