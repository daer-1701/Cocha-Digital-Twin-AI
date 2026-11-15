import type { DataNature } from "../components/ui/nature-badge";

export type Section = {
  href: string;
  label: string;
  title: string;
  summary: string;
  available: boolean;
  /** Kind of result the section will show once it exists. */
  nature?: DataNature;
  /** What must exist before the section can show real results. */
  requires?: string[];
};

export const SECTIONS: Section[] = [
  {
    href: "/?territorio=distritos",
    label: "Explorador",
    title: "Microclimas urbanos con IA",
    summary:
      "Mapa de distritos con evidencia de superficie, clima modelado e interpretación por inteligencia artificial.",
    available: true,
    nature: "observed",
  },
  {
    href: "/analisis",
    label: "Análisis 2014–2025",
    title: "Análisis de la ventana piloto",
    summary: "Doce adquisiciones Landsat, cambio por año y significancia estadística.",
    available: true,
  },
  {
    href: "/comparar",
    label: "Comparar distritos",
    title: "Comparar distritos",
    summary:
      "Catálogo oficial de distritos GAMC. La comparación LST/NDVI aparece cuando existan estadísticas zonales aceptadas.",
    available: true,
    nature: "observed",
    requires: [
      "Límites oficiales de los 15 distritos en formato vectorial, con versión y licencia.",
      "Indicadores por distrito calculados con una serie multianual comparable.",
      "Tendencias con intervalo y significancia evaluadas en el backend.",
    ],
  },
  {
    href: "/estaciones",
    label: "Estaciones",
    title: "Estaciones MÓNICA (PM10)",
    summary:
      "Estaciones municipales de material particulado PM10, con los metadatos que faltan confirmar antes de analizar sus series.",
    available: true,
    nature: "observed",
  },
  {
    href: "/informes",
    label: "Informes",
    title: "Informes y descargas",
    summary:
      "Descargar las observaciones de la área de estudio en CSV o JSON, con fuente, unidades, período y limitaciones.",
    available: true,
    nature: "observed",
  },
  {
    href: "/modelos",
    label: "Estimaciones",
    title: "Estimaciones con modelos",
    summary:
      "Valores estimados donde no hay sensores, siempre con intervalo, métricas fuera de muestra y límites de uso.",
    available: false,
    nature: "estimated",
    requires: [
      "Una variable objetivo con mediciones de referencia compatibles. Los datos MÓNICA disponibles solo contienen PM10.",
      "Validación fuera de muestra que demuestre ventaja frente a un modelo de referencia.",
      "Registro del modelo con versión, período de entrenamiento y detección de casos fuera de dominio.",
    ],
  },
  {
    href: "/procesamiento",
    label: "Procesamiento",
    title: "Procesamiento y trazabilidad",
    summary: "Historial de importaciones y ejecuciones registradas.",
    available: true,
  },
  {
    href: "/escenarios",
    label: "Escenarios",
    title: "Escenarios hipotéticos",
    summary:
      "Explorar qué podría cambiar con más áreas verdes, sin presentarlo como un efecto garantizado.",
    available: false,
    nature: "simulated",
    requires: [
      "Un modelo validado que admita la intervención y su rango.",
      "Supuestos, variables fijas e incertidumbre definidos por el backend.",
    ],
  },
  {
    href: "/asistente",
    label: "Asistente",
    title: "IA de microclimas",
    summary:
      "Presupuesto Gemini y evidencia que puede citar. En el mapa, la IA interpreta el microclima del distrito seleccionado.",
    available: true,
    requires: [
      "Clave Gemini y GEMINI_CALLS_ENABLED en el servidor API.",
      "API_ASSISTANT_TOKEN coincidente en la web (servidor) y en la API.",
      "Evidencia publicada (piloto y, si existen, series distritales aceptadas).",
    ],
  },
];

export function section(href: string): Section {
  const found = SECTIONS.find((s) => s.href === href);
  if (!found) throw new Error(`Unknown section ${href}`);
  return found;
}
