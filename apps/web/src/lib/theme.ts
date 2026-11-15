export type ThemeMode = "day" | "night";

export const THEME_STORAGE_KEY = "cocha-map-light";

/** Resolve stored map-light preference, then system preference. Never invents a third mode. */
export function resolveTheme(stored: string | null | undefined): ThemeMode {
  if (stored === "day" || stored === "night") return stored;
  if (typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: light)").matches) {
    return "day";
  }
  return "night";
}

/** Map illumination only — must not change page chrome or color-scheme. */
export function applyTheme(mode: ThemeMode) {
  document.documentElement.dataset.mapLight = mode;
  delete document.documentElement.dataset.theme;
  document.documentElement.style.removeProperty("color-scheme");
}
