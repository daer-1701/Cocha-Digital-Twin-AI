import type { Metadata } from "next";
import Link from "next/link";
import { DemoBanner } from "../../components/ui/demo-banner";
import { NatureBadge } from "../../components/ui/nature-badge";
import { PageHeader } from "../../components/ui/page-header";
import { Panel } from "../../components/ui/panel";
import { ServerDetail } from "../../components/ui/server-detail";
import { StatusPanel } from "../../components/ui/status-panel";
import { getStations, type Stations } from "../../lib/api";
import { section } from "../../lib/navigation";

const current = section("/estaciones");
export const metadata: Metadata = { title: current.title };
export const dynamic = "force-dynamic";

type Station = NonNullable<Stations["items"]>[number];

const PENDING: Record<string, string> = {
  "PM10 units": "Unidad de medida del PM10",
  timezone: "Zona horaria de las fechas",
  "station coordinates and identity reconciliation":
    "Coordenadas e identidad de la estación",
  "measurement QA codes and zero interpretation":
    "Códigos de calidad y significado de los ceros y negativos",
  "data redistribution license": "Licencia de redistribución de los datos",
};

const STATUS_TEXT: Record<Stations["status"], string> = {
  empty:
    "Las mediciones todavía no se importaron. Se listan las estaciones conocidas del catálogo municipal, sin valores.",
  available: "Estaciones importadas en el servidor.",
  unavailable: "El servidor no puede ofrecer las estaciones en este momento.",
};

const displayName = (name: string) => name.charAt(0).toUpperCase() + name.slice(1);

function StationCard({ station }: { station: Station }) {
  const located = station.latitude != null && station.longitude != null;
  const pending = station.metadata_pending ?? [];
  return (
    <Panel title={displayName(station.name)} meta={`Identificador: ${station.source_id}`}>
      <dl className="facts">
        <dt>Variable</dt>
        <dd>{station.variable.toUpperCase()}, material particulado en el aire</dd>
        <dt>Unidad</dt>
        <dd>{station.unit ?? "Pendiente de confirmar"}</dd>
        <dt>Zona horaria</dt>
        <dd>
          {station.timezone ??
            "Pendiente. Las fechas originales no indican desfase y no se asume UTC."}
        </dd>
        <dt>Ubicación</dt>
        <dd>
          {located
            ? `${station.latitude?.toFixed(5)}, ${station.longitude?.toFixed(5)}`
            : "Pendiente de confirmar. No se dibuja en el mapa hasta tener coordenadas oficiales."}
        </dd>
        <dt>Elevación</dt>
        <dd>
          {station.elevation_m != null ? `${station.elevation_m} m` : "Pendiente de confirmar"}
        </dd>
        <dt>Análisis</dt>
        <dd>
          {station.analysis_enabled
            ? "Habilitado"
            : "Desactivado hasta confirmar los metadatos"}
        </dd>
      </dl>
      {pending.length > 0 && (
        <>
          <h3>Metadatos pendientes</h3>
          <ul>
            {pending.map((item) =>
              PENDING[item] ? (
                <li key={item}>{PENDING[item]}</li>
              ) : (
                <li key={item} lang="en">
                  {item}
                </li>
              ),
            )}
          </ul>
        </>
      )}
    </Panel>
  );
}

export default async function Page() {
  const { data, demo } = await getStations();
  const stations = data?.items ?? [];
  return (
    <>
      <DemoBanner state={demo} />
      <PageHeader title={current.title}>
        <p>{current.summary}</p>
        <NatureBadge nature={demo === "active" ? "synthetic" : "observed"} detailed />
      </PageHeader>
      <div className="note">
        El PM10 mide partículas en el aire. No es temperatura y no sirve para
        calibrar ni validar la temperatura superficial (LST) del explorador.
      </div>
      {!data ? (
        <StatusPanel
          status="error"
          title="No se pudo consultar las estaciones"
          action={<Link href="/estaciones">Volver a intentar</Link>}
        >
          <p>
            La API no respondió o devolvió un formato inesperado. Comprueba que esté
            en marcha y que <code>API_INTERNAL_URL</code> apunte a ella.
          </p>
        </StatusPanel>
      ) : (
        <>
          <section className="station-status" aria-label="Estado de las estaciones">
            <p>{STATUS_TEXT[data.status]}</p>
            <ServerDetail reason={data.reason} />
          </section>
          {stations.length > 0 ? (
            <div className="card-grid">
              {stations.map((station) => (
                <StationCard key={station.id ?? station.source_id} station={station} />
              ))}
            </div>
          ) : (
            <StatusPanel status="empty" title="El servidor no lista estaciones" />
          )}
          <Panel title="Series de PM10" meta="Pendiente">
            <p>
              El servidor todavía no publica series por estación. Cuando lo haga, se
              mostrarán con su cobertura y con los valores negativos y ceros marcados
              para revisión, sin convertir faltantes en cero.
            </p>
          </Panel>
        </>
      )}
    </>
  );
}
