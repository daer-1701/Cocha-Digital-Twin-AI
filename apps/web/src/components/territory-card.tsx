import type { components } from "@cocha/shared";
import { boundsSizeKm } from "../lib/territory";
import { Panel } from "./ui/panel";

type Snapshot = components["schemas"]["Snapshot"];

const Coordinate = ({ axis, value }: { axis: string; value: number }) => (
  <span className="coordinate">
    {axis} {value.toFixed(4)}
  </span>
);

export function TerritoryCard({ evidence }: { evidence: Snapshot }) {
  const [west, south, east, north] = evidence.bounds;
  const size = boundsSizeKm(evidence.bounds);
  const dates = evidence.scenes.map((scene) => scene.acquired_at.slice(0, 10));
  return (
    <Panel title="Ficha del territorio" className="territory-card">
      <dl>
        <dt>Nombre</dt>
        <dd>{evidence.area_name}</dd>
        <dt>Tipo</dt>
        <dd>Ventana rectangular de estudio</dd>
        <dt>Límites (WGS84)</dt>
        <dd className="code">
          <Coordinate axis="O" value={west} />,{" "}
          <Coordinate axis="S" value={south} />,{" "}
          <Coordinate axis="E" value={east} />,{" "}
          <Coordinate axis="N" value={north} />
        </dd>
        <dt>Extensión aproximada</dt>
        <dd>
          {size.width.toFixed(1)} km × {size.height.toFixed(1)} km
        </dd>
        <dt>Escenas publicadas</dt>
        <dd>
          {dates.length === 0
            ? "Ninguna"
            : dates.length === 1
              ? `1, del ${dates[0]}`
              : `${dates.length}, del ${dates[0]} al ${dates[dates.length - 1]}`}
        </dd>
        <dt>Producto</dt>
        <dd>{evidence.product_version}</dd>
      </dl>
      <p className="caption">
        No es un límite municipal ni distrital. El análisis por distrito se
        habilitará cuando el servidor publique límites oficiales completos y sus
        resultados.
      </p>
    </Panel>
  );
}
