import type { components } from "@cocha/shared";
import { Panel } from "./ui/panel";

type Indicator = components["schemas"]["DemoIndicatorItem"];
type Trend = components["schemas"]["DemoTrendItem"];

// Same fixed LST scale as the explorer map: 0 °C blue, 25 °C cream, 50 °C red.
const STOPS: [number, [number, number, number]][] = [
  [0, [0x23, 0x57, 0xa6]],
  [25, [0xff, 0xe9, 0xa1]],
  [50, [0xd4, 0x3d, 0x42]],
];

function heat(value: number): string {
  const v = Math.min(50, Math.max(0, value));
  const upper = v <= 25 ? 1 : 2;
  const [x0, c0] = STOPS[upper - 1];
  const [x1, c1] = STOPS[upper];
  const t = (v - x0) / (x1 - x0);
  const [r, g, b] = c0.map((c, i) => Math.round(c + (c1[i] - c) * t));
  return `rgb(${r} ${g} ${b})`;
}

const fmt = (value: number | null | undefined, digits: number) =>
  value == null ? "Sin datos" : value.toFixed(digits);

function signed(value: number | null, digits: number) {
  if (value == null) return "Sin pendiente";
  return `${value > 0 ? "+" : value < 0 ? "−" : ""}${Math.abs(value).toFixed(digits)}`;
}

type Row = {
  number: number;
  name: string;
  lst: Indicator | undefined;
  ndvi: Indicator | undefined;
  lstTrend: Trend | undefined;
};

/** Demo rectangles only. Never rendered for official district results. */
export function DistrictBoard({
  indicators,
  trends,
  sceneId,
}: {
  indicators: Indicator[];
  trends: Trend[];
  sceneId: string | null;
}) {
  const demo = indicators.filter(
    (i) => i.nature === "demo_synthetic" && i.scene_id === sceneId,
  );
  if (demo.length === 0) return null;
  const numbers = [...new Set(demo.map((i) => i.district_number))].sort((a, b) => a - b);
  const rows: Row[] = numbers.map((number) => {
    const of = (variable: Indicator["variable"]) =>
      demo.find((i) => i.district_number === number && i.variable === variable);
    const lst = of("lst_celsius");
    return {
      number,
      name: lst?.district_name ?? of("ndvi")?.district_name ?? `Área sintética ${number}`,
      lst,
      ndvi: of("ndvi"),
      lstTrend: trends.find(
        (t) => t.district_number === number && t.variable === "lst_celsius",
      ),
    };
  });
  const ranked = [...rows].sort(
    (a, b) => (b.lst?.value ?? -Infinity) - (a.lst?.value ?? -Infinity),
  );
  // Rectangles in demo_districts.geojson run west→east, south→north; draw north on top.
  const tiles = [...rows].sort(
    (a, b) => Math.ceil(b.number / 5) - Math.ceil(a.number / 5) || a.number - b.number,
  );
  const scene = demo[0]?.scene_id;
  const version = demo[0]?.boundary_version;

  return (
    <Panel
      title="Vista de prueba con rectángulos sintéticos"
      meta={`${version}, escena ${scene}`}
      className="district-board"
    >
      <p className="warning">
        Estos 15 rectángulos no son distritos de Cochabamba. Sirven para probar la
        comparación mientras faltan los límites oficiales. Los valores son medias de
        las celdas cuyo centro cae dentro de cada rectángulo.
      </p>
      <div className="board">
        <figure className="tile-map">
          <div className="tiles" role="img" aria-label="Mosaico de LST media por rectángulo sintético; mismos valores en la tabla">
            {tiles.map((row) => (
              <div
                key={row.number}
                className="tile"
                style={{
                  background: row.lst?.value == null ? undefined : heat(row.lst.value),
                }}
                data-missing={row.lst?.value == null || undefined}
              >
                <span>{row.number}</span>
                <strong>{fmt(row.lst?.value, 1)}</strong>
              </div>
            ))}
          </div>
          <figcaption>
            <span className="legend">
              <span>0 °C</span>
              <span className="gradient heat" />
              <span>50 °C</span>
            </span>
            LST media por rectángulo, escala fija. El norte queda arriba.
          </figcaption>
        </figure>
        <div className="table-wrap">
          <table>
            <caption>
              Ordenado de mayor a menor LST. La pendiente es descriptiva, en °C por
              adquisición, sin prueba de significancia.
            </caption>
            <thead>
              <tr>
                <th scope="col">Rectángulo</th>
                <th scope="col">LST (°C)</th>
                <th scope="col">NDVI</th>
                <th scope="col">Pendiente LST</th>
                <th scope="col">Celdas válidas</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((row) => (
                <tr key={row.number}>
                  <th scope="row">{row.name}</th>
                  <td>
                    <span className="bar-cell">
                      <span className="bar-track" aria-hidden="true">
                        <span
                          className="bar"
                          style={{
                            width: `${Math.min(90, Math.max(0, ((row.lst?.value ?? 0) / 50) * 90))}px`,
                            background: row.lst?.value == null ? undefined : heat(row.lst.value),
                          }}
                        />
                      </span>
                      {fmt(row.lst?.value, 1)}
                    </span>
                  </td>
                  <td>{fmt(row.ndvi?.value, 3)}</td>
                  <td>
                    {row.lstTrend?.status === "descriptive"
                      ? signed(row.lstTrend.slope_per_step, 2)
                      : "Insuficiente"}
                    {row.lstTrend && (
                      <small className="trend-n"> n = {row.lstTrend.n_finite}</small>
                    )}
                  </td>
                  <td>
                    {row.lst
                      ? `${row.lst.n_valid} de ${row.lst.n_valid + row.lst.n_missing}`
                      : "Sin datos"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Panel>
  );
}
