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
    href: "/",
    label: "Explorador",
    title: "Temperatura superficial y vegetación",
    summary:
      "Observaciones Landsat sobre una ventana urbana de estudio, con su cobertura y procedencia.",
    available: true,
    nature: "observed",
  },
  {
    href: "/comparar",
    label: "Comparar distritos",
    title: "Comparar distritos",
    summary:
      "Ver qué distritos cambian más, con magnitud, cobertura e incertidumbre visibles.",
    available: false,
    nature: "observed",
    requires: [
      "Límites oficiales de los 15 distritos en formato vectorial, con versión y licencia.",
      "Indicadores por distrito calculados con una serie multianual comparable.",
      "Tendencias con intervalo y significancia evaluadas en el backend.",
    ],
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
    title: "Asistente científico",
    summary:
      "Preguntar por la evidencia publicada y recibir respuestas que citan su fuente.",
    available: false,
    requires: [
      "Integración en el servidor con límite de presupuesto y cuota por consulta.",
      "Resultados estructurados que el asistente pueda citar sin inventar cifras.",
    ],
  },
];

export function section(href: string): Section {
  const found = SECTIONS.find((s) => s.href === href);
  if (!found) throw new Error(`Unknown section ${href}`);
  return found;
}
