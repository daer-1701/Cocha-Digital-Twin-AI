import type { Evidence } from "../lib/api";
import { Panel } from "./ui/panel";

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
export function ComparisonPanel({ first, second }: { first: Scene; second: Scene }) {
  const [older, newer] =
    first.acquired_at <= second.acquired_at ? [first, second] : [second, first];
  const a = older.acquired_at.slice(0, 10);
  const b = newer.acquired_at.slice(0, 10);
  const rows = [
    { label: "LST media válida (°C)", a: older.lst_mean, b: newer.lst_mean, digits: 1 },
    { label: "NDVI medio válido", a: older.ndvi_mean, b: newer.ndvi_mean, digits: 3 },
    {
      label: "Cobertura válida (%)",
      a: older.valid_fraction * 100,
      b: newer.valid_fraction * 100,
      digits: 1,
    },
  ];
  const lowCoverage = [older, newer].filter((s) => s.valid_fraction < LOW_COVERAGE);
  return (
    <Panel title="Comparación entre dos fechas" meta="Diferencia descriptiva" className="comparison">
      <div className="table-wrap">
        <table>
          <caption>
            Medias de toda la ventana en cada fecha. Diferencia calculada como {b} menos {a}.
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
              <tr key={row.label}>
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
        Son dos días concretos. La diferencia puede deberse al clima de cada día, a la
        hora de paso y a las nubes; no indica una tendencia ni su significancia.
      </p>
    </Panel>
  );
}
