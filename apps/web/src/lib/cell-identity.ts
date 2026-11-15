import type { components } from "@cocha/shared";

type Cell = components["schemas"]["Cell"];

/** Stable spatial key from published cell bounds (5 decimals ≈ 1 m). */
export function cellKey(bounds: Cell["bounds"]): string {
  return bounds.map((n) => Number(n.toFixed(5))).join(",");
}

/** Find the same cell in another scene by matching published bounds. */
export function findMatchingCellIndex(
  cells: Cell[],
  bounds: Cell["bounds"] | undefined,
): number | null {
  if (!bounds) return null;
  const key = cellKey(bounds);
  const index = cells.findIndex((cell) => cellKey(cell.bounds) === key);
  return index >= 0 ? index : null;
}

export function cellsShareGrid(a: Cell[], b: Cell[]): boolean {
  if (a.length === 0 || b.length === 0) return false;
  const keys = new Set(b.map((cell) => cellKey(cell.bounds)));
  return a.some((cell) => keys.has(cellKey(cell.bounds)));
}
