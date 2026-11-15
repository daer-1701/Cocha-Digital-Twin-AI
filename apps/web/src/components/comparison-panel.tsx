import type { Evidence } from "../lib/api";
import type { ReactNode } from "react";
import { Panel } from "./ui/panel";
import { SignalGauge } from "./ui/signal-gauge";

type Scene = Evidence["scenes"][number];

const LOW_COVERAGE = 0.7;

const fmt = (value: number | null, digits: number) =>
  value === null ? "Sin datos" : value.toFixed(digits);

function difference(a: number | null, b: number | null, digits: number) {
  if (a === null || b === null) return "Sin datos";
  const d = b - a;
  return `${d > 0 ? "+" : d < 0 ? "−" : ""}${Math.abs(d).toFixed(digits)}`;
}

/** Descriptive difference between two acquisition days; never a trend. */
export function ComparisonPanel({ first, second, controls }: { first: Scene; second: Scene; controls?: ReactNode }) {
  const [older, newer] =
    first.acquired_at <= second.acquired_at ? [first, second] : [second, first];
  const a = older.acquired_at.slice(0, 10);
  const b = newer.acquired_at.slice(0, 10);
  const rows = [
    {
      label: "LST media válida (°C)",
      signal: "heat" as const,
      a: older.lst_mean,
      b: newer.lst_mean,
      digits: 1,
      min: 0,
      max: 50,
      unit: " °C",
    },
    {
      label: "NDVI medio válido",
      signal: "vegetation" as const,
      a: older.ndvi_mean,
      b: newer.ndvi_mean,
      digits: 3,
      min: -1,
      max: 1,
      unit: "",
    },
    {
      label: "Cobertura válida (%)",
      signal: "coverage" as const,
      a: older.valid_fraction * 100,
      b: newer.valid_fraction * 100,
      digits: 1,
      min: 0,
      max: 100,
      unit: "%",
    },
  ];
  const lowCoverage = [older, newer].filter((s) => s.valid_fraction < LOW_COVERAGE);
  return (
    <Panel
      title="Comparación entre dos fechas"
      meta="Diferencia descriptiva"
      className="comparison"
    >
      {controls}
      <div className="comparison-signals">
        {rows.map((row) => (
          <article key={row.label} className="comparison-signal" data-signal={row.signal}>
            <p className="metric-label">{row.label}</p>
            <div className="comparison-signal-values">
              <div>
                <span>{a}</span>
                <strong>{fmt(row.a, row.digits)}</strong>
                <SignalGauge
                  signal={row.signal}
                  value={row.a}
                  min={row.min}
                  max={row.max}
                  unit={row.unit}
                />
              </div>
              <div>
                <span>{b}</span>
                <strong>{fmt(row.b, row.digits)}</strong>
                <SignalGauge
                  signal={row.signal}
                  value={row.b}
                  min={row.min}
                  max={row.max}
                  unit={row.unit}
                />
              </div>
              <div className="comparison-delta">
                <span>Diferencia {row.signal === "coverage" ? "(puntos porcentuales)" : row.unit ? `(${row.unit.trim()})` : "(sin unidad)"}</span>
                <strong>{difference(row.a, row.b, row.digits)}</strong>
              </div>
            </div>
          </article>
        ))}
      </div>
      <div className="table-wrap">
        <table>
          <caption>
            Medias de toda la ventana en cada fecha. Diferencia calculada como {b} menos{" "}
            {a}.
          </caption>
          <thead>
            <tr>
              <th scope="col">Indicador</th>
              <th scope="col">{a}</th>
              <th scope="col">{b}</th>
              <th scope="col">Diferencia</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} data-signal={row.signal}>
                <th scope="row">{row.label}</th>
                <td>{fmt(row.a, row.digits)}</td>
                <td>{fmt(row.b, row.digits)}</td>
                <td>{difference(row.a, row.b, row.digits)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {lowCoverage.length > 0 && (
        <p className="warning" role="status">
          Cobertura reducida en {lowCoverage.map((s) => s.acquired_at.slice(0, 10)).join(" y ")}:
          {lowCoverage.length > 1
            ? " las medias de esas fechas describen"
            : " las medias de esa fecha describen"}{" "}
          solo una parte de la ventana, o ninguna si no hay datos.
        </p>
      )}
      <p className="caption">
        Cada media usa los píxeles válidos de su propia fecha; no necesariamente los mismos píxeles.
        {" "}
        Son dos días concretos. La diferencia puede deberse al clima de cada día, a la
        hora de paso y a las nubes; no indica una tendencia ni su significancia.
      </p>
      <p className="caption">Fuentes: <a href={older.source_url} target="_blank" rel="noreferrer">Escena del {a}</a>{" y "}<a href={newer.source_url} target="_blank" rel="noreferrer">escena del {b}</a>.</p>
    </Panel>
  );
}
