import Link from "next/link";
import { getPilotPackage } from "../../lib/pilot-analysis";
import { PageHeader } from "../../components/ui/page-header";
import { Panel } from "../../components/ui/panel";
import "./analysis.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Análisis Landsat 2014–2025" };
const number = (n: number, digits = 5) => n.toLocaleString("es-BO", {
  minimumFractionDigits: digits, maximumFractionDigits: digits,
});

export default async function AnalysisPage() {
  const local = await getPilotPackage();
  if (!local) return <Panel title="Análisis local no disponible">
    <p>No se ha preparado el paquete científico en esta instalación.</p>
    <Link href="/?territorio=distritos">Volver al explorador</Link>
  </Panel>;
  const { analysis, evidence } = local;
  return <div className="analysis-page">
    <PageHeader title="¿Qué cambió entre 2014 y 2025?">
      <p>Doce adquisiciones de julio de Landsat 8, en la misma ventana urbana.
        Análisis exploratorio de temperatura superficial y vegetación.</p>
    </PageHeader>
    <Panel title="Resultado del análisis">
      <p className="analysis-conclusion">{Object.values(analysis.results).some((r) => r.significant_at_005_holm)
        ? "Se detectó una tendencia lineal significativa en al menos una variable."
        : "No se detectó una tendencia lineal estadísticamente significativa."}</p>
      <p>Las cifras varían entre fechas. Con esta muestra no podemos concluir que exista
        un cambio sostenido. Esto tampoco demuestra ausencia de cambio.</p>
      <p>Soporte válido común: <strong>{number(analysis.common_valid_fraction * 100, 2)} %</strong>
        {" · "}{analysis.common_pixels.toLocaleString("es-BO")} píxeles por adquisición.
        La unidad estadística es cada fecha, no cada píxel.</p>
      <Link href="/">Explorar las 12 fechas en el mapa</Link>
    </Panel>
    <Panel title="Cambio por año e incertidumbre">
      <div className="analysis-results">
        {(["lst_celsius", "ndvi"] as const).map((key) => {
          const r = analysis.results[key];
          const unit = key === "lst_celsius" ? "°C/año" : "NDVI/año";
          return <section key={key}>
            <h3>{key === "lst_celsius" ? "Temperatura superficial" : "Vegetación · NDVI"}</h3>
            <p className="analysis-value">{r.slope_per_year >= 0 ? "+" : ""}{number(r.slope_per_year)} {unit}</p>
            <dl><dt>Intervalo de confianza del 95 %</dt>
              <dd>{number(r.ci95[0])} a {number(r.ci95[1])} {unit}</dd>
              <dt>Valor p, ajustado por Holm</dt><dd>{number(r.p_value_holm)}</dd>
              <dt>Evaluación con umbral 0,05</dt><dd>{r.significant_at_005_holm ? "Significativa" : "No significativa"}</dd>
              <dt>Adquisiciones analizadas</dt><dd>{r.n}</dd></dl>
          </section>;
        })}
      </div>
      <p>El intervalo expresa incertidumbre en la pendiente, no en cada medición.
        Los intervalos son marginales; la decisión corrige los dos contrastes mediante Holm.</p>
    </Panel>
    <Panel title="Evolución sobre los mismos píxeles">
      {/* Scientific figure generated from the exact downloadable analysis. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="analysis-figure" src="/pilot-analysis/trends.png"
        alt="Series LST y NDVI de julio 2014–2025 y ajustes lineales. Ninguna pendiente es significativa; los valores exactos se muestran en la tabla siguiente." />
      <p>Una adquisición por año. No son promedios mensuales ni anuales.</p>
    </Panel>
    <Panel title="Comprobar los datos por fecha">
      <p>Esta tabla y el CSV muestran las medias del <strong>soporte común</strong> usado en
        las pruebas. El mapa y sus exportaciones muestran medias sobre los píxeles válidos
        de cada escena; pueden diferir ligeramente. No son indicadores distritales.</p>
      <div className="analysis-table" tabIndex={0} role="region" aria-label="Datos por fecha, desplazamiento horizontal">
        <table><caption>Valores utilizados en el análisis estadístico</caption>
          <thead><tr><th scope="col">Fecha UTC</th><th scope="col">LST (°C)</th>
            <th scope="col">NDVI</th><th scope="col">Cobertura de escena</th><th scope="col">Escena de origen</th></tr></thead>
          <tbody>{analysis.series.map((row) => <tr key={row.scene_id}>
            <th scope="row">{row.acquired_at.slice(0, 10)}</th>
            <td>{number(row.lst_celsius)}</td><td>{number(row.ndvi)}</td>
            <td>{number(row.scene_valid_fraction * 100, 2)} %</td>
            <td><a href={evidence.scenes.find((s) => s.id === row.scene_id)!.source_url}
              target="_blank" rel="noreferrer">{row.scene_id}</a></td>
          </tr>)}</tbody></table>
      </div>
      <div className="downloads">{[["series.csv", "Descargar datos CSV"],
        ["analysis.json", "Descargar resultados JSON"], ["manifest.json", "Fuentes y hashes"],
        ["trends.png", "Descargar gráfico"]].map(([file, label]) =>
          <a key={file} href={`/pilot-analysis/${file}`} download>{label}</a>)}</div>
      <p>Los archivos publicados fueron cotejados entre sí y sus hashes se verifican
        al cargar los datos de esta página.</p>
    </Panel>
    <Panel title="Método y límites de interpretación">
      <p>Regresión lineal por año calendario. Se usa el mayor error estándar entre OLS
        convencional y ajustes de autocorrelación HAC con retardos 1 y 2.
        Intervalos y pruebas con aproximación t de 10 grados de libertad.
        Inferencia exploratoria con una muestra temporal pequeña.</p>
      <ul>{analysis.limitations.map((item) => <li key={item}>{item}</li>)}</ul>
      <p>Generado: {analysis.generated_at}. Fuente: Landsat Collection 2 Level-2, USGS/NASA.</p>
    </Panel>
  </div>;
}
