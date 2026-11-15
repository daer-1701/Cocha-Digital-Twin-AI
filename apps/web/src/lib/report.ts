import type { ObservationExport } from "./api";
import type { SearchParams } from "./filters";

export type ReportContent = "escenas" | "celdas";
export type ReportFormat = "json" | "csv";
export type ReportSelection = { content: ReportContent; sceneId: string | null };

const first = (value: string | string[] | null | undefined) =>
  Array.isArray(value) ? value[0] : (value ?? undefined);

/** Invalid values fall back to the whole export; cells always need one scene. */
export function parseSelection(
  params: SearchParams | URLSearchParams,
  exported: ObservationExport,
): ReportSelection {
  const get = (key: string) =>
    params instanceof URLSearchParams ? params.get(key) : first(params[key]);
  const ids = exported.evidence.scenes.map((s) => s.id);
  const requested = get("escena");
  const content: ReportContent = get("contenido") === "celdas" ? "celdas" : "escenas";
  let sceneId = requested && ids.includes(requested) ? requested : null;
  if (content === "celdas" && !sceneId) sceneId = ids[ids.length - 1] ?? null;
  return { content, sceneId };
}

export function selectionQuery(selection: ReportSelection): string {
  const query = new URLSearchParams({ contenido: selection.content });
  if (selection.sceneId) query.set("escena", selection.sceneId);
  return query.toString();
}

export function selectedScenes(exported: ObservationExport, selection: ReportSelection) {
  const scenes = exported.evidence.scenes;
  return selection.sceneId ? scenes.filter((s) => s.id === selection.sceneId) : scenes;
}

export function reportFilename(
  format: ReportFormat,
  selection: ReportSelection,
  synthetic: boolean,
): string {
  const parts = [
    synthetic ? "DEMO-SINTETICO" : null,
    "cocha-observaciones-ventana-piloto",
    selection.content,
    selection.sceneId,
  ].filter(Boolean);
  return `${parts.join("_").replace(/[^A-Za-z0-9_.-]/g, "-")}.${format}`;
}

/** Text cells that a spreadsheet could evaluate as a formula. */
function csvCell(value: string | number | null | undefined): string {
  if (value == null) return "";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  const text = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

const row = (values: (string | number | null | undefined)[]) => values.map(csvCell).join(",");

export function buildCsv(
  exported: ObservationExport,
  selection: ReportSelection,
  synthetic: boolean,
  downloadedAt: Date,
): string {
  const evidence = exported.evidence;
  const scenes = selectedScenes(exported, selection);
  const meta = [
    synthetic
      ? "DEMO: datos sintéticos de prueba; no son observaciones de Cochabamba"
      : null,
    `Alcance: ventana piloto (${exported.scope}); no es un informe distrital`,
    `Área: ${evidence.area_name}; límites WGS84 ${evidence.bounds.join(" ")}`,
    `Fuente: ${evidence.collection} ${evidence.product_version}; licencia ${evidence.license}`,
    `Snapshot generado: ${evidence.generated_at}; descargado: ${downloadedAt.toISOString()}`,
    "Unidades: lst en °C (temperatura superficial, no del aire); ndvi sin unidad; valid_fraction de 0 a 1",
    "Celdas vacías = sin datos (no cero)",
    `Nota de procedencia: ${exported.note}`,
  ].filter((line): line is string => line !== null);
  const header = meta.map((line) => `# ${line.replace(/[\r\n]+/g, " ")}`);
  if (selection.content === "celdas") {
    const lines = scenes.flatMap((scene) =>
      scene.cells.map((cell) =>
        row([scene.id, scene.acquired_at, ...cell.bounds, cell.lst, cell.ndvi]),
      ),
    );
    return [
      ...header,
      "scene_id,acquired_at,west,south,east,north,lst_c,ndvi",
      ...lines,
    ].join("\r\n");
  }
  const lines = scenes.map((scene) =>
    row([
      scene.id,
      scene.acquired_at,
      scene.platform,
      scene.lst_mean,
      scene.ndvi_mean,
      scene.valid_fraction,
      scene.valid_pixels,
      scene.total_pixels,
      scene.source_url,
    ]),
  );
  return [
    ...header,
    "scene_id,acquired_at,platform,lst_mean_c,ndvi_mean,valid_fraction,valid_pixels,total_pixels,source_url",
    ...lines,
  ].join("\r\n");
}

export function buildJson(
  exported: ObservationExport,
  selection: ReportSelection,
  synthetic: boolean,
  downloadedAt: Date,
) {
  const scenes = selectedScenes(exported, selection).map((scene) =>
    selection.content === "celdas" ? scene : { ...scene, cells: undefined },
  );
  return {
    download: {
      downloaded_at: downloadedAt.toISOString(),
      source: exported.note.startsWith("Paquete local verificado")
        ? "local:pilot-analysis/explorer.json"
        : "/v1/reports observation_export",
      selection: { content: selection.content, scene_id: selection.sceneId },
      synthetic_fixture: synthetic,
    },
    ...exported,
    evidence: { ...exported.evidence, scenes },
  };
}
