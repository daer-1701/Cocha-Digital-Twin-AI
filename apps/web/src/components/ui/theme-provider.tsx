"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { applyTheme, resolveTheme, THEME_STORAGE_KEY, type ThemeMode } from "../../lib/theme";

type ThemeContextValue = {
  theme: ThemeMode;
  setTheme: (mode: ThemeMode) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);
const THEME_EVENT = "cocha-theme";

function readDomTheme(): ThemeMode {
  const fromDom = document.documentElement.dataset.mapLight;
  if (fromDom === "day" || fromDom === "night") return fromDom;
  try {
    return resolveTheme(window.localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return "night";
  }
}

function subscribe(onStoreChange: () => void) {
  const handler = () => onStoreChange();
  window.addEventListener(THEME_EVENT, handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener(THEME_EVENT, handler);
    window.removeEventListener("storage", handler);
  };
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useSyncExternalStore(subscribe, readDomTheme, () => "night" as ThemeMode);

  // Restore map light and strip any legacy page-theme attrs from older builds.
  useEffect(() => {
    applyTheme(readDomTheme());
  }, []);

  const setTheme = useCallback((mode: ThemeMode) => {
    applyTheme(mode);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch {
      /* storage may be blocked; map light still applies for the session */
    }
    window.dispatchEvent(new Event(THEME_EVENT));
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === "night" ? "day" : "night");
  }, [setTheme, theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useTheme requires ThemeProvider");
  return value;
}

function SunIcon() {
  return (
    <svg className="theme-toggle-icon" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="4" fill="currentColor" />
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M18.4 5.6l-1.6 1.6M7.2 16.8l-1.6 1.6"
      />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg className="theme-toggle-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M15.4 3.1a8.6 8.6 0 0 0-1.2.1 7.8 7.8 0 1 0 6.6 12.4A8.2 8.2 0 0 1 15.4 3.1Z"
      />
    </svg>
  );
}

export function ThemeToggle({ disabled = false }: { disabled?: boolean }) {
  const { theme, setTheme } = useTheme();

  return (
    <div className="theme-toggle" data-mode={theme}>
      <div className="theme-toggle-copy">
        <strong>Iluminación</strong>
        <span>{theme === "day" ? "Modo día" : "Modo noche"} · solo el mapa</span>
      </div>
      <div className="theme-toggle-switch" role="group" aria-label="Iluminación del mapa 3D">
        <button
          type="button"
          aria-pressed={theme === "day"}
          disabled={disabled}
          onClick={() => setTheme("day")}
        >
          <SunIcon />
          Día
        </button>
        <button
          type="button"
          aria-pressed={theme === "night"}
          disabled={disabled}
          onClick={() => setTheme("night")}
        >
          <MoonIcon />
          Noche
        </button>
      </div>
      <span className="sr-only" aria-live="polite">
        {theme === "day" ? "Modo día" : "Modo noche"} activo. Cambia la iluminación
        del mapa 3D; no es una adquisición satelital nocturna.
      </span>
    </div>
  );
}

/** Inline script: restore map light only. Never touches page theme / color-scheme. */
export const THEME_BOOT_SCRIPT = `(function(){try{var k=${JSON.stringify(THEME_STORAGE_KEY)};var t=localStorage.getItem(k);if(t!=="day"&&t!=="night"){t=window.matchMedia("(prefers-color-scheme: light)").matches?"day":"night";}document.documentElement.dataset.mapLight=t;delete document.documentElement.dataset.theme;document.documentElement.style.removeProperty("color-scheme");}catch(e){document.documentElement.dataset.mapLight="night";}})();`;
