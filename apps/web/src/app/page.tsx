import Link from "next/link";
import {
  getDistricts,
  getEvidence,
  getTerritories,
  mergeDemo,
} from "../lib/api";
import {
  filtersToQuery,
  parseFilters,
  type SearchParams,
} from "../lib/filters";
import { territoryOptions } from "../lib/territory";
import { Explorer } from "../components/explorer";
import { DemoBanner } from "../components/ui/demo-banner";
import { PageHeader } from "../components/ui/page-header";
import { StatusPanel } from "../components/ui/status-panel";
import "./observatory.css";

export const dynamic = "force-dynamic";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const [{ data, error, demo }, territories, districts, params] =
    await Promise.all([
      getEvidence(),
      getTerritories(),
      getDistricts({ includeGeometry: true }),
      searchParams,
    ]);
  const pageDemo = mergeDemo(
    demo,
    territories.demo,
    districts.demo,
  );
  const officialDistricts =
    districts.data?.status === "available" ? (districts.data.items ?? []) : [];
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
    <div className="observatory">
      <DemoBanner state={pageDemo} />
      <PageHeader title="Temperatura superficial y vegetación">
        <p>Explora una fecha, selecciona una zona y consulta qué sabemos de su superficie.</p>
      </PageHeader>
      {demo === "off" && data?.scenes.length === 12 && data.scenes[0]?.acquired_at.startsWith("2014") && (
        <p className="note">12 adquisiciones de julio entre 2014 y 2025.
          {" "}<Link href="/analisis">Ver análisis estadístico y comprobar los datos</Link>.
          Las cifras del mapa son medias por escena; las pruebas usan píxeles comunes.</p>
      )}
      {data && parsed ? (
        <Explorer
          key={filtersToQuery(parsed.filters)}
          evidence={data}
          synthetic={demo === "active"}
          initial={parsed.filters}
          notices={parsed.notices}
          catalog={territories.data}
          districts={officialDistricts}
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
    </div>
  );
}
