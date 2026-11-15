import type { Metadata } from "next";
import Link from "next/link";
import { DemoBanner } from "../../components/ui/demo-banner";
import { NatureBadge } from "../../components/ui/nature-badge";
import { PageHeader } from "../../components/ui/page-header";
import { Panel } from "../../components/ui/panel";
import { ServerDetail } from "../../components/ui/server-detail";
import { StatusPanel } from "../../components/ui/status-panel";
import { getReports } from "../../lib/api";
import type { SearchParams } from "../../lib/filters";
import { section } from "../../lib/navigation";
import {
  parseSelection,
  reportFilename,
  selectedScenes,
  selectionQuery,
} from "../../lib/report";

const current = section("/informes");
export const metadata: Metadata = { title: current.title };
export const dynamic = "force-dynamic";

const format = (value: number | null | undefined, digits: number) =>
  value == null ? "Sin datos" : value.toFixed(digits);
const day = (iso: string) => iso.slice(0, 10);

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const [{ data, demo }, params] = await Promise.all([getReports(), searchParams]);
  const synthetic = demo === "active";
  const header = (
    <>
      <DemoBanner state={demo} />
      <PageHeader title={current.title}>
        <p>{current.summary}</p>
        <NatureBadge nature={synthetic ? "synthetic" : "observed"} detailed />
      </PageHeader>
    </>
  );

  if (!data)
    return (
      <>
        {header}
        <StatusPanel
          status="error"
          title="No se pudo consultar los informes"
          action={<Link href="/informes">Volver a intentar</Link>}
        >
          <p>
            La API no respondió o devolvió un formato inesperado. Comprueba que esté
            en marcha y que <code>API_INTERNAL_URL</code> apunte a ella.
          </p>
        </StatusPanel>
      </>
    );

  const exported = data.observation_export;
  if (!exported)
    return (
      <>
        {header}
        <StatusPanel status="empty" title="No hay observaciones para exportar">
          <p>
            El servidor todavía no publicó un snapshot de la área de estudio. Los
            informes distritales formales también están pendientes.
          </p>
          <ServerDetail reason={data.reason} />
        </StatusPanel>
      </>
    );

  const evidence = exported.evidence;
  const selection = parseSelection(params, exported);
  const scenes = selectedScenes(exported, selection);
  const query = selectionQuery(selection);
  const first = evidence.scenes[0];
  const last = evidence.scenes[evidence.scenes.length - 1];
  const cells = scenes.reduce((sum, s) => sum + s.cells.length, 0);

  return (
    <>
      {header}
      <div className="note">
        Exporta las observaciones del área de estudio mostradas en el explorador.
        No es un informe por distrito ni incluye tendencias, estimaciones
        o escenarios.
      </div>
      <p><Link href="/analisis">Ver análisis estadístico y descargar la serie sobre soporte común</Link>.
        Estas exportaciones usan medias por escena; la serie del análisis compara los mismos píxeles.</p>
      <div className="panel-stack">
        <Panel title="Contenido del informe" meta="Selección">
          <form className="report-form" method="get" action="/informes">
            <div className="field">
              <label htmlFor="informe-contenido">Contenido</label>
              <select
                id="informe-contenido"
                name="contenido"
                defaultValue={selection.content}
              >
                <option value="escenas">Resumen por escena</option>
                <option value="celdas">Celdas de una escena</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="informe-escena">Escena</label>
              <select
                id="informe-escena"
                name="escena"
                defaultValue={selection.sceneId ?? ""}
              >
                <option value="">Todas (solo resumen por escena)</option>
                {evidence.scenes.map((s) => (
                  <option key={s.id} value={s.id}>
                    {day(s.acquired_at)}, {s.platform}
                  </option>
                ))}
              </select>
            </div>
            <button type="submit">Actualizar vista previa</button>
          </form>
          {selection.content === "celdas" && !params.escena && (
            <p className="caption">
              Las celdas se exportan por escena; se seleccionó la más reciente.
            </p>
          )}
          <div className="downloads" aria-label="Descargas">
            <a href={`/api/informes/csv?${query}`} download>
              Descargar CSV
            </a>
            <a href={`/api/informes/json?${query}`} download>
              Descargar JSON
            </a>
            <small>
              Archivo: <code>{reportFilename("csv", selection, synthetic)}</code>
              {synthetic && ". Rotulado como datos sintéticos: contiene datos sintéticos de prueba."}
            </small>
          </div>
        </Panel>
        <Panel title="Metadatos" meta={`Snapshot del ${day(evidence.generated_at)}`}>
          <dl className="facts facts-readouts">
            <div className="readout" data-signal="ground">
              <dt>Alcance</dt>
              <dd>Área de estudio ({evidence.area_name}); no es un informe distrital</dd>
            </div>
            <div className="readout" data-signal="coverage">
              <dt>Período</dt>
              <dd>
                {first && last
                  ? `${day(first.acquired_at)} a ${day(last.acquired_at)}, ${evidence.scenes.length} escenas`
                  : "Sin escenas"}
              </dd>
            </div>
            <div className="readout" data-signal="heat">
              <dt>Fuente</dt>
              <dd>
                {evidence.collection}, versión {evidence.product_version}
              </dd>
            </div>
            <div className="readout" data-signal="ground">
              <dt>Licencia</dt>
              <dd lang="en">{evidence.license}</dd>
            </div>
            <div className="readout" data-signal="vegetation">
              <dt>Unidades</dt>
              <dd>
                LST en °C (temperatura de la superficie, no del aire); NDVI sin unidad;
                cobertura válida de 0 a 1
              </dd>
            </div>
            <div className="readout" data-signal="coverage">
              <dt>Generación</dt>
              <dd>
                Snapshot generado el {evidence.generated_at}. La fecha de descarga se
                agrega al archivo.
              </dd>
            </div>
            <div className="readout" data-signal="heat">
              <dt>Datos faltantes</dt>
              <dd>Se dejan vacíos en el CSV y como null en el JSON; nunca como cero.</dd>
            </div>
          </dl>
          <ServerDetail reason={exported.note} />
          {evidence.limitations.length > 0 && (
            <>
              <h3>Limitaciones publicadas</h3>
              <ul lang="en">
                {evidence.limitations.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </>
          )}
        </Panel>
        <Panel
          title="Vista previa"
          meta={
            selection.content === "celdas"
              ? `${cells.toLocaleString("es-BO")} celdas`
              : `${scenes.length} escenas`
          }
        >
          {selection.content === "celdas" ? (
            <p>
              El archivo incluye {cells.toLocaleString("es-BO")} celdas de la escena del{" "}
              {scenes[0] ? day(scenes[0].acquired_at) : "—"}, con sus límites y valores
              de LST y NDVI. Las celdas sin datos quedan vacías.
            </p>
          ) : null}
          <div className="table-wrap" tabIndex={0} role="region" aria-label="Tabla de datos desplazable">
            <table>
              <caption>Resumen de las escenas incluidas en la descarga</caption>
              <thead>
                <tr>
                  <th scope="col">Fecha (UTC)</th>
                  <th scope="col">Plataforma</th>
                  <th scope="col">LST media (°C)</th>
                  <th scope="col">NDVI medio</th>
                  <th scope="col">Cobertura válida</th>
                </tr>
              </thead>
              <tbody>
                {scenes.map((s) => (
                  <tr key={s.id}>
                    <td>{day(s.acquired_at)}</td>
                    <td>{s.platform}</td>
                    <td>{format(s.lst_mean, 2)}</td>
                    <td>{format(s.ndvi_mean, 3)}</td>
                    <td>{format(s.valid_fraction * 100, 1)} %</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
      <p className="caption">
        <Link href="/?territorio=distritos">Volver al explorador</Link>
      </p>
    </>
  );
}
