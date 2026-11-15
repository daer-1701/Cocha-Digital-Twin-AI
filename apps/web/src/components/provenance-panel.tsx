import type { Evidence } from "../lib/api";
import { boundsSizeKm } from "../lib/territory";
import { NatureBadge } from "./ui/nature-badge";

type Scene = Evidence["scenes"][number];

function cellSize(scene: Scene): string {
  const cell = scene.cells[0];
  if (!cell) return "Sin celdas publicadas";
  const { width, height } = boundsSizeKm(cell.bounds);
  return `≈ ${Math.round(width * 1000)} m × ${Math.round(height * 1000)} m, calculado de los límites de la celda`;
}

/** Where each figure comes from, using only fields present in the snapshot contract. */
export function ProvenancePanel({
  evidence,
  scene,
  synthetic,
}: {
  evidence: Evidence;
  scene: Scene;
  synthetic: boolean;
}) {
  const acquired = scene.acquired_at.replace("T", " ").slice(0, 16);
  return (
    <section className="panel provenance" aria-labelledby="procedencia">
      <header className="provenance-intro">
        <p className="section-kicker">
          <span className="signal-dot signal-ground" aria-hidden="true" />
          Una cifra debe poder explicarse
        </p>
        <h2 id="procedencia">El recorrido de la evidencia</h2>
        <ol className="evidence-chain">
          <li data-stage="source">
            <span>Fuente</span>
            <strong>{evidence.collection}</strong>
            <p>{evidence.product_version}</p>
          </li>
          <li data-stage="acquisition">
            <span>Adquisición</span>
            <strong>{scene.acquired_at.slice(0, 10)}</strong>
            <p>{scene.platform}</p>
          </li>
          <li data-stage="coverage">
            <span>Cobertura válida</span>
            <strong>{(scene.valid_fraction * 100).toFixed(1)} %</strong>
            <p>{scene.valid_pixels.toLocaleString("es-BO")} píxeles válidos</p>
          </li>
          <li data-stage="publish">
            <span>Publicación</span>
            <strong>{evidence.generated_at.slice(0, 10)}</strong>
            <p>Valores y procedencia consultables</p>
          </li>
        </ol>
      </header>
      <div>
        <h3>Registro de la adquisición</h3>
        <dl className="facts facts-readouts">
          <div className="readout" data-signal="vegetation">
            <dt>Naturaleza</dt>
            <dd>
              <NatureBadge nature={synthetic ? "synthetic" : "observed"} />
            </dd>
          </div>
          <div className="readout" data-signal="ground">
            <dt>Colección</dt>
            <dd className="code">{evidence.collection}</dd>
          </div>
          <div className="readout" data-signal="ground">
            <dt>Producto</dt>
            <dd>{evidence.product_version}</dd>
          </div>
          <div className="readout" data-signal="ground">
            <dt>Licencia</dt>
            <dd>{evidence.license}</dd>
          </div>
          <div className="readout" data-signal="heat">
            <dt>Plataforma</dt>
            <dd>{scene.platform}</dd>
          </div>
          <div className="readout" data-signal="heat">
            <dt>Escena</dt>
            <dd className="code">{scene.id}</dd>
          </div>
          <div className="readout" data-signal="heat">
            <dt>Adquisición</dt>
            <dd>{acquired} UTC</dd>
          </div>
          <div className="readout" data-signal="vegetation">
            <dt>Unidades</dt>
            <dd>LST en °C; NDVI sin unidad, de −1 a 1</dd>
          </div>
          <div className="readout" data-signal="ground">
            <dt>Celda del mapa</dt>
            <dd>{cellSize(scene)}</dd>
          </div>
          <div className="readout" data-signal="ground">
            <dt>Resolución nativa</dt>
            <dd>
              No incluida en el snapshot; consulta el método y el registro de la escena
            </dd>
          </div>
          <div className="readout" data-signal="coverage">
            <dt>Cobertura válida</dt>
            <dd>
              {(scene.valid_fraction * 100).toFixed(1)} % (
              {scene.valid_pixels.toLocaleString("es-BO")} de{" "}
              {scene.total_pixels.toLocaleString("es-BO")} píxeles tras la máscara de
              calidad)
            </dd>
          </div>
          <div className="readout" data-signal="coverage">
            <dt>Snapshot</dt>
            <dd>
              Generado el {evidence.generated_at.slice(0, 10)}
              {!synthetic && ", con manifiesto de sumas de verificación"}
            </dd>
          </div>
        </dl>
        <p>
          <a href={scene.source_url} target="_blank" rel="noreferrer">
            Ver el registro STAC de la escena
            <span className="sr-only"> (se abre en una pestaña nueva)</span> ↗
          </a>
        </p>
      </div>
      <div>
        <h2>Cuándo no confiar en estas cifras</h2>
        <ul className="limitation-list">
          {evidence.limitations.map((limitation) => (
            <li key={limitation}>{limitation}</li>
          ))}
        </ul>
        <section className="method-visible" aria-labelledby="metodo-calculo">
          <h3 id="metodo-calculo">Método de cálculo</h3>
          <p>{evidence.method}</p>
        </section>
      </div>
    </section>
  );
}
