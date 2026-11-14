import { DEFAULT_TERRITORY, isTerritoryId, type TerritoryId } from "./territory";

export type Variable = "lst" | "ndvi";

export type ExplorerFilters = {
  territory: TerritoryId;
  sceneId: string;
  /** Second acquisition for the descriptive comparison, if any. */
  compareId: string | null;
  variable: Variable;
};

export type SearchParams = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

/**
 * Reads shareable filters from the URL. Invalid or unavailable values fall back
 * to defaults and produce a notice instead of failing silently.
 */
export function parseFilters(
  params: SearchParams,
  sceneIds: string[],
  availableTerritories: TerritoryId[],
): { filters: ExplorerFilters; notices: string[] } {
  const notices: string[] = [];
  const latest = sceneIds[sceneIds.length - 1] ?? "";

  let territory = DEFAULT_TERRITORY;
  const requestedTerritory = first(params.territorio);
  if (requestedTerritory !== undefined) {
    if (
      isTerritoryId(requestedTerritory) &&
      availableTerritories.includes(requestedTerritory)
    )
      territory = requestedTerritory;
    else
      notices.push(
        "El territorio del enlace todavía no está disponible. Se muestra la ventana piloto.",
      );
  }

  let sceneId = latest;
  const requestedScene = first(params.escena);
  if (requestedScene !== undefined) {
    if (sceneIds.includes(requestedScene)) sceneId = requestedScene;
    else
      notices.push(
        "La escena del enlace no está en los datos publicados. Se muestra la más reciente.",
      );
  }

  let compareId: string | null = null;
  const requestedCompare = first(params.comparar);
  if (requestedCompare !== undefined && requestedCompare !== "") {
    if (sceneIds.includes(requestedCompare) && requestedCompare !== sceneId)
      compareId = requestedCompare;
    else
      notices.push(
        "La fecha de comparación del enlace no es válida. Se muestra sin comparación.",
      );
  }

  let variable: Variable = "lst";
  const requestedVariable = first(params.variable);
  if (requestedVariable !== undefined) {
    if (requestedVariable === "lst" || requestedVariable === "ndvi")
      variable = requestedVariable;
    else
      notices.push(
        "La variable del enlace no es válida. Se muestra la temperatura superficial.",
      );
  }

  return { filters: { territory, sceneId, compareId, variable }, notices };
}

export function filtersToQuery(filters: ExplorerFilters): string {
  const query = new URLSearchParams({
    territorio: filters.territory,
    escena: filters.sceneId,
    variable: filters.variable,
  });
  if (filters.compareId) query.set("comparar", filters.compareId);
  return query.toString();
}
