import Link from "next/link";
import {
  getEvidence,
  getSeries,
  getTerritories,
  getTrends,
  mergeDemo,
} from "../lib/api";
import {
  filtersToQuery,
  parseFilters,
  type SearchParams,
} from "../lib/filters";
import { section } from "../lib/navigation";
import { territoryOptions } from "../lib/territory";
import { Explorer } from "../components/explorer";
import { DemoBanner } from "../components/ui/demo-banner";
import { PageHeader } from "../components/ui/page-header";
import { StatusPanel } from "../components/ui/status-panel";

export const dynamic = "force-dynamic";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const [{ data, error, demo }, territories, trends, series, params] =
    await Promise.all([
      getEvidence(),
      getTerritories(),
      getTrends(),
      getSeries(),
      searchParams,
    ]);
  const current = section("/");
  const pageDemo = mergeDemo(demo, territories.demo, trends.demo, series.demo);
  const parsed =
    data &&
    parseFilters(
      params,
      data.scenes.map((scene) => scene.id),
      territoryOptions(data, territories.data)
        .filter((option) => option.available)
        .map((option) => option.id),
    );
  return (
    <>
      <DemoBanner state={pageDemo} />
      <PageHeader title={current.title}>
        <p>{current.summary}</p>
      </PageHeader>
      {data && parsed ? (
        <Explorer
          key={filtersToQuery(parsed.filters)}
          evidence={data}
          synthetic={demo === "active"}
          initial={parsed.filters}
          notices={parsed.notices}
          catalog={territories.data}
          trends={trends.data}
          series={series.data}
        />
      ) : error ? (
        <StatusPanel
          status="error"
          title="No se pudo consultar la evidencia"
          action={<Link href="/">Volver a intentar</Link>}
        >
          <p>
            La API no respondió o devolvió un error. Comprueba que esté en marcha y
            que <code>API_INTERNAL_URL</code> apunte a ella.
          </p>
        </StatusPanel>
      ) : (
        <StatusPanel status="empty" title="Todavía no hay observaciones publicadas">
          <p>
            Ejecuta la ingesta Landsat descrita en el README para publicar un
            snapshot. No se muestran valores de ejemplo.
          </p>
        </StatusPanel>
      )}
    </>
  );
}
