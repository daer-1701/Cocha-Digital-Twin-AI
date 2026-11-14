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
      <div>
        <h2 id="procedencia">De dónde salen estos datos</h2>
        <dl className="facts">
          <dt>Naturaleza</dt>
          <dd>
            <NatureBadge nature={synthetic ? "synthetic" : "observed"} />
          </dd>
          <dt>Colección</dt>
          <dd className="code">{evidence.collection}</dd>
          <dt>Producto</dt>
          <dd>{evidence.product_version}</dd>
          <dt>Licencia</dt>
          <dd>{evidence.license}</dd>
          <dt>Plataforma</dt>
          <dd>{scene.platform}</dd>
          <dt>Escena</dt>
          <dd className="code">{scene.id}</dd>
          <dt>Adquisición</dt>
          <dd>{acquired} UTC</dd>
          <dt>Unidades</dt>
          <dd>LST en °C; NDVI sin unidad, de −1 a 1</dd>
          <dt>Celda del mapa</dt>
          <dd>{cellSize(scene)}</dd>
          <dt>Resolución nativa</dt>
          <dd>No incluida en el snapshot; consulta el método y el registro de la escena</dd>
          <dt>Cobertura válida</dt>
          <dd>
            {(scene.valid_fraction * 100).toFixed(1)} % (
            {scene.valid_pixels.toLocaleString("es-BO")} de{" "}
            {scene.total_pixels.toLocaleString("es-BO")} píxeles tras la máscara de calidad)
          </dd>
          <dt>Snapshot</dt>
          <dd>
            Generado el {evidence.generated_at.slice(0, 10)}
            {!synthetic && ", con manifiesto de sumas de verificación"}
          </dd>
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
        <ul>
          {evidence.limitations.map((limitation) => (
            <li key={limitation}>{limitation}</li>
          ))}
        </ul>
        <details>
          <summary>Método de cálculo</summary>
          <p>{evidence.method}</p>
        </details>
      </div>
    </section>
  );
}
