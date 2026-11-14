import type { Evidence } from "../lib/api";
import type { Variable } from "../lib/filters";

// Same fixed range as the map legend, so distances are not exaggerated by autoscaling.
const RANGE: Record<Variable, [number, number]> = { lst: [0, 50], ndvi: [-1, 1] };
const TOP = 30;
const BASE = 150;

/** Independent points per acquisition; no line, so gaps and trends are not implied. */
export function ObservationChart({
  scenes,
  variable,
  selectedId,
}: {
  scenes: Evidence["scenes"];
  variable: Variable;
  selectedId: string;
}) {
  const [low, high] = RANGE[variable];
  const x = (index: number) => 100 + (index * 440) / Math.max(1, scenes.length - 1);
  const y = (value: number) => {
    const clamped = Math.min(high, Math.max(low, value));
    return BASE - ((clamped - low) / (high - low)) * (BASE - TOP);
  };
  const unit = variable === "lst" ? " °C" : "";
  const missing = scenes.filter((s) => (variable === "lst" ? s.lst_mean : s.ndvi_mean) === null);
  return (
    <svg
      viewBox="0 0 600 195"
      role="img"
      aria-label={`Media por fecha en escala fija de ${low} a ${high}${unit}; puntos independientes, sin línea de tendencia${
        missing.length ? `; ${missing.length} fecha(s) sin datos` : ""
      }`}
    >
      <line x1="60" x2="570" y1={BASE} y2={BASE} className="axis" />
      <line x1="60" x2="60" y1={TOP} y2={BASE} className="axis" />
      <text x="54" y={TOP + 4} textAnchor="end">
        {high}
        {unit}
      </text>
      <text x="54" y={BASE + 4} textAnchor="end">
        {low}
        {unit}
      </text>
      {scenes.map((scene, index) => {
        const value = variable === "lst" ? scene.lst_mean : scene.ndvi_mean;
        const date = scene.acquired_at.slice(0, 10);
        const selected = scene.id === selectedId;
        return (
          <g key={scene.id}>
            {value === null ? (
              <>
                <circle cx={x(index)} cy={BASE - 12} r="6" className="point-missing" />
                <text x={x(index)} y={BASE - 26} textAnchor="middle">
                  Sin datos
                </text>
              </>
            ) : (
              <>
                <circle
                  cx={x(index)}
                  cy={y(value)}
                  r="6"
                  className={selected ? "point point-selected" : "point"}
                />
                <text x={x(index)} y={y(value) - 14} textAnchor="middle">
                  {value.toFixed(variable === "lst" ? 1 : 3)}
                </text>
              </>
            )}
            <text
              x={x(index)}
              y="182"
              textAnchor="middle"
              className={selected ? "label-selected" : undefined}
            >
              {date}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
