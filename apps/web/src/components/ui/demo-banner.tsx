import type { DemoState } from "../../lib/api";

export function DemoBanner({ state }: { state: DemoState }) {
  if (state === "off") return null;
  return (
    <div className="demo-banner" role="note">
      <strong>Demo</strong>
      {state === "active"
        ? "Datos sintéticos de desarrollo. No son observaciones reales."
        : "La API apunta al servidor de datos sintéticos. Producción los bloquea: configura API_INTERNAL_URL con la API real."}
    </div>
  );
}
