import type { Metadata } from "next";
import Link from "next/link";
import { PendingSection } from "../../components/pending-section";
import { DemoBanner } from "../../components/ui/demo-banner";
import { NatureBadge } from "../../components/ui/nature-badge";
import { PageHeader } from "../../components/ui/page-header";
import { Panel } from "../../components/ui/panel";
import { ServerDetail } from "../../components/ui/server-detail";
import { StatusPanel } from "../../components/ui/status-panel";
import {
  getDistricts,
  getSeries,
  getTerritories,
  getTrends,
  mergeDemo,
} from "../../lib/api";
import { section } from "../../lib/navigation";

const current = section("/comparar");
export const metadata: Metadata = { title: current.title };
export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: {
  searchParams: Promise<{ offset?: string | string[]; boundary_version?: string | string[] }>;
}) {
  const params = await searchParams;
  const rawOffset = typeof params.offset === "string" ? Number(params.offset) : 0;
  const offset = Number.isSafeInteger(rawOffset) && rawOffset >= 0 && rawOffset <= 100000 ? rawOffset : 0;
  const version = typeof params.boundary_version === "string" ? params.boundary_version.slice(0, 100) || undefined : undefined;
  const pageUrl = (next: number) => `/comparar?${new URLSearchParams({
    offset: String(next),
    ...(version ? { boundary_version: version } : {}),
  })}`;

  const [territories, districts, series, trends] = await Promise.all([
    getTerritories(),
    getDistricts({ boundaryVersion: version }),
    getSeries(offset, version),
    getTrends(),
  ]);
  const demo = mergeDemo(
    territories.demo,
    districts.demo,
    series.demo,
    trends.demo,
  );
  const vector = territories.data?.vector_districts;
  const versions = districts.data?.boundary_versions ?? [];
  const versionPicker = (
    <form method="get" className="controls">
      <label>
        Límites territoriales
        <select name="boundary_version" defaultValue={version ?? ""}>
          <option value="">Seleccionar versión</option>
          {versions.map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
      </label>
      <button type="submit">Consultar versión</button>
    </form>
  );
  const officialReady = districts.data?.status === "available";
  const reasons = [
    vector?.reason,
    districts.data?.reason,
    series.data?.reason,
    trends.data?.reason,
  ].filter((reason): reason is string => Boolean(reason));

  const officialItems = series.data?.official_items ?? [];
  const officialTrends = trends.data?.official_trends ?? [];
  const districtRows = districts.data?.items ?? [];
  const indicatorsReady =
    series.data?.status === "available" && officialItems.length > 0;

  // Official boundaries are real published data — do not wrap them in the
  // "no example values" pending shell, which reads as if everything were demo.
  if (!officialReady) {
    return (
      <PendingSection
        section={current}
        demo={demo}
        server={{
          status: territories.data || districts.data ? "unavailable" : null,
          items: reasons,
        }}
      >
        {versionPicker}
        <section className="panel" aria-labelledby="district-evidence-status">
          <h2 id="district-evidence-status">Resultados distritales</h2>
          <p>
            La comparación aparecerá cuando el servidor publique el catálogo de
            límites oficiales. No se muestran rectángulos sintéticos en su lugar.
          </p>
          <ServerDetail reason={vector?.reason ?? districts.data?.reason} />
        </section>
      </PendingSection>
    );
  }

  return (
    <>
      <DemoBanner state={demo} />
      <PageHeader title={current.title}>
        <p>{current.summary}</p>
        <NatureBadge nature="observed" detailed />
      </PageHeader>

      <Panel
        title="Distritos oficiales"
        meta={districts.data?.boundary_version ?? undefined}
        className="district-catalog"
      >
        <p>
          Catálogo municipal importado ({districtRows.length} distritos). Estos
          polígonos son límites oficiales GAMC, no rectángulos de demostración.
          La comparación de LST/NDVI aparece solo cuando hay estadísticas zonales
          aceptadas.
        </p>
        <ServerDetail reason={vector?.reason} />
        <div className="table-wrap" tabIndex={0} role="region" aria-label="Datos distritales, tabla desplazable">
          <table>
            <caption>Límites oficiales publicados por el servidor</caption>
            <thead>
              <tr>
                <th scope="col">N.º</th>
                <th scope="col">Distrito</th>
                <th scope="col">Versión</th>
              </tr>
            </thead>
            <tbody>
              {districtRows.map((row) => (
                <tr key={row.id}>
                  <th scope="row">{row.number}</th>
                  <td>{row.name}</td>
                  <td>{row.boundary_version}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {versionPicker}
      <nav aria-label="Páginas de indicadores">
        {offset > 0 && <Link href={pageUrl(Math.max(0, offset - 50))}>Anterior</Link>}
        {" "}
        {series.data?.has_more && <Link href={pageUrl(offset + 50)}>Siguiente</Link>}
      </nav>
      <section className="panel" aria-labelledby="district-indicators-status">
        <h2 id="district-indicators-status">Indicadores por distrito</h2>
        {indicatorsReady ? (
          <>
            <p>
              Estadísticas zonales aceptadas sobre la versión oficial. LST es
              temperatura de superficie, no del aire.
            </p>
            <div className="table-wrap" tabIndex={0} role="region" aria-label="Datos distritales, tabla desplazable">
              <table>
                <caption>Indicadores oficiales aceptados</caption>
                <thead>
                  <tr>
                    <th scope="col">Distrito</th>
                    <th scope="col">Variable</th>
                    <th scope="col">Estadístico</th>
                    <th scope="col">Valor</th>
                    <th scope="col">Período</th>
                    <th scope="col">Cobertura</th>
                  </tr>
                </thead>
                <tbody>
                  {officialItems.map((item) => (
                    <tr key={item.id}>
                      <th scope="row">
                        {item.district_number}. {item.district_name}
                      </th>
                      <td>{item.variable}</td>
                      <td>{item.statistic}</td>
                      <td>
                        {item.value == null
                          ? "Sin datos"
                          : item.value.toFixed(
                              item.variable.includes("ndvi") ? 3 : 1,
                            )}
                        {item.units ? ` ${item.units}` : ""}
                      </td>
                      <td>
                        {item.period_start} → {item.period_end}
                      </td>
                      <td>
                        {item.valid_fraction == null
                          ? "—"
                          : `${(item.valid_fraction * 100).toFixed(0)}%`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <StatusPanel
            status="pending"
            title="Faltan estadísticas zonales aceptadas"
            action={<Link href="/">Ver la malla Landsat en el explorador</Link>}
          >
            <p>
              No hay indicadores aceptados en esta página para la versión
              consultada. Revisa la versión territorial o vuelve a la página
              anterior si avanzaste en los resultados.
            </p>
            <ServerDetail reason={series.data?.reason} items={reasons} />
          </StatusPanel>
        )}
        {officialTrends.length > 0 ? (
          <p className="caption">
            El servidor también publicó {officialTrends.length} tendencia(s)
            oficial(es) aceptada(s).
          </p>
        ) : (
          <ServerDetail reason={trends.data?.reason} />
        )}
      </section>
    </>
  );
}
