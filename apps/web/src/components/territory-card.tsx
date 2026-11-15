import type { components } from "@cocha/shared";
import type { OfficialDistrict } from "../lib/districts-geojson";
import { boundsSizeKm, type TerritoryId } from "../lib/territory";
import { Panel } from "./ui/panel";

type Snapshot = components["schemas"]["Snapshot"];

const Coordinate = ({ axis, value }: { axis: string; value: number }) => (
  <span className="coordinate">
    {axis} {value.toFixed(4)}
  </span>
);

export function TerritoryCard({
  evidence,
  territory,
  districts,
}: {
  evidence: Snapshot;
  territory: TerritoryId;
  districts: OfficialDistrict[];
}) {
  if (territory === "distritos" && districts.length > 0) {
    const version = districts[0]?.boundary_version;
    return (
      <Panel title="Ficha del territorio" className="territory-card" meta={version}>
        <dl className="facts-readouts">
          <div className="readout" data-signal="ground">
            <dt>Tipo</dt>
            <dd>Distritos municipales oficiales</dd>
          </div>
          <div className="readout" data-signal="coverage">
            <dt>Cantidad</dt>
            <dd>{districts.length} polígonos</dd>
          </div>
          <div className="readout" data-signal="ground">
            <dt>Versión</dt>
            <dd>{version}</dd>
          </div>
          <div className="readout" data-signal="ground">
            <dt>Fuente</dt>
            <dd className="code">{districts[0]?.source_url}</dd>
          </div>
        </dl>
        <p className="caption">
          Polígonos oficiales GAMC (Tunari, Molle, Alejo Calatayud…). No es la
          malla blanca Landsat. Al seleccionar un distrito, el mapa consulta
          /v1/series para indicadores zonales aceptados; si faltan o la cobertura
          es nula, se muestra ese estado sin inventar cifras.
        </p>
      </Panel>
    );
  }

  const [west, south, east, north] = evidence.bounds;
  const size = boundsSizeKm(evidence.bounds);
  const dates = evidence.scenes.map((scene) => scene.acquired_at.slice(0, 10));
  return (
    <Panel title="Ficha del territorio" className="territory-card">
      <dl className="facts-readouts">
        <div className="readout" data-signal="ground">
          <dt>Nombre</dt>
          <dd>{evidence.area_name}</dd>
        </div>
        <div className="readout" data-signal="ground">
          <dt>Tipo</dt>
          <dd>Ventana rectangular de estudio</dd>
        </div>
        <div className="readout" data-signal="coverage">
          <dt>Límites (WGS84)</dt>
          <dd className="code">
            <Coordinate axis="O" value={west} />,{" "}
            <Coordinate axis="S" value={south} />,{" "}
            <Coordinate axis="E" value={east} />,{" "}
            <Coordinate axis="N" value={north} />
          </dd>
        </div>
        <div className="readout" data-signal="heat">
          <dt>Extensión aproximada</dt>
          <dd>
            {size.width.toFixed(1)} km × {size.height.toFixed(1)} km
          </dd>
        </div>
        <div className="readout" data-signal="vegetation">
          <dt>Escenas publicadas</dt>
          <dd>
            {dates.length === 0
              ? "Ninguna"
              : dates.length === 1
                ? `1, del ${dates[0]}`
                : `${dates.length}, del ${dates[0]} al ${dates[dates.length - 1]}`}
          </dd>
        </div>
        <div className="readout" data-signal="ground">
          <dt>Producto</dt>
          <dd>{evidence.product_version}</dd>
        </div>
      </dl>
      <p className="caption">
        No es un límite municipal. Cambia a «Distritos municipales» para ver los
        polígonos oficiales.
      </p>
    </Panel>
  );
}
