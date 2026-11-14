"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { Evidence, PilotTrend, Series, Territories, Trends } from "../lib/api";
import {
  filtersToQuery,
  type ExplorerFilters,
  type Variable,
} from "../lib/filters";
import { territoryOptions } from "../lib/territory";
import { ComparisonPanel } from "./comparison-panel";
import { SceneTimeline } from "./scene-timeline";
import { MapLayers } from "./map-layers";
import { ObservationChart } from "./observation-chart";
import { ProvenancePanel } from "./provenance-panel";
import { TerritoryCard } from "./territory-card";
import { TerritorySelector } from "./territory-selector";
import { Metric } from "./ui/metric";
import { NatureBadge } from "./ui/nature-badge";
import { Panel } from "./ui/panel";
import { ServerDetail } from "./ui/server-detail";
import { StatusPanel } from "./ui/status-panel";

const StudyMap = dynamic(() => import("./study-map"), {
  ssr: false,
  loading: () => (
    <div className="map-placeholder" role="status">
      Cargando el valle…
    </div>
  ),
});
const format = (value: number | null | undefined, digits = 2) =>
  value == null ? "Sin datos" : value.toFixed(digits);

type CopyState = "idle" | "copied" | "failed";

function PilotSlope({ item, variable }: { item: PilotTrend; variable: Variable }) {
  const lst = variable === "lst";
  const label = lst ? "LST" : "NDVI";
  const counts = `${item.n_finite} escenas con valor; mínimo requerido: ${item.min_n}.`;
  if (item.status === "inconclusive" || item.slope_per_step == null)
    return (
      <div className="pilot-slope">
        <p>
          Pendiente descriptiva del {label} en la ventana piloto: no concluyente. {counts}
        </p>
        <ServerDetail reason={item.note} />
      </div>
    );
  const slope = item.slope_per_step;
  const value = `${slope > 0 ? "+" : slope < 0 ? "−" : ""}${Math.abs(slope).toFixed(lst ? 2 : 3)}`;
  return (
    <div className="pilot-slope">
      <p>
        Pendiente descriptiva del {label} en la ventana piloto:{" "}
        <strong>
          {value}
          {lst ? " °C" : ""}
        </strong>{" "}
        por escena, en orden de adquisición. {counts}
      </p>
      <p className="caption">
        Resume las fechas disponibles con una recta; no es una tendencia por
        distrito, no tiene escala temporal anual y no publica significancia ni
        causas.
      </p>
      <ServerDetail reason={item.note} />
    </div>
  );
}

function TrendStatus({ trends, variable }: { trends: Trends | null; variable: Variable }) {
  if (!trends)
    return <p>No se pudo consultar en el servidor si hay tendencias publicadas.</p>;
  const text = {
    unavailable:
      "Por distrito, todavía no. El servidor no publica tendencias: hace falta una serie más larga y comparable por distrito, tratando la estacionalidad y la autocorrelación.",
    empty: "El servidor no tiene tendencias por distrito calculadas para esta área.",
    available:
      "El servidor publicó tendencias por distrito, pero esta vista todavía no las muestra.",
  }[trends.status];
  const key = variable === "lst" ? "lst_mean" : "ndvi_mean";
  const pilot = trends.pilot_trends?.find((item) => item.variable === key);
  return (
    <>
      <p>{text}</p>
      <ServerDetail reason={trends.reason} />
      {pilot && <PilotSlope item={pilot} variable={variable} />}
    </>
  );
}

function SeriesStatus({ series }: { series: Series | null }) {
  const text = !series
    ? "No se pudo consultar el estado de las series por distrito."
    : {
        unavailable: "Series por distrito: todavía no disponibles en el servidor.",
        empty: "Series por distrito: el servidor no tiene registros.",
        available: "Series por distrito: publicadas, pendientes de integrar en esta vista.",
      }[series.status];
  return (
    <div className="series-status">
      <p className="caption">{text}</p>
      <ServerDetail reason={series?.reason} />
    </div>
  );
}

export function Explorer({
  evidence,
  synthetic,
  initial,
  notices,
  catalog,
  trends,
  series,
}: {
  evidence: Evidence;
  synthetic: boolean;
  initial: ExplorerFilters;
  notices: string[];
  catalog: Territories | null;
  trends: Trends | null;
  series: Series | null;
}) {
  const pathname = usePathname();
  const [filters, setFilters] = useState(initial);
  const [copy, setCopy] = useState<CopyState>("idle");
  const [overlays, setOverlays] = useState<string[]>([]);
  const [failedOverlays, setFailedOverlays] = useState<string[]>([]);
  const update = (change: Partial<ExplorerFilters>) => {
    const next = { ...filters, ...change };
    if (next.compareId === next.sceneId) next.compareId = null;
    setFilters(next);
    setCopy("idle");
    window.history.replaceState(null, "", `${pathname}?${filtersToQuery(next)}`);
  };
  const copyLink = async () => {
    const url = `${window.location.origin}${pathname}?${filtersToQuery(filters)}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopy("copied");
    } catch {
      setCopy("failed");
    }
  };
  const toggleOverlay = (id: string, on: boolean) => {
    setFailedOverlays((current) => current.filter((x) => x !== id));
    setOverlays((current) =>
      on ? [...current.filter((x) => x !== id), id] : current.filter((x) => x !== id),
    );
  };
  const overlayFailed = (id: string) =>
    setFailedOverlays((current) => (current.includes(id) ? current : [...current, id]));

  const { variable } = filters;
  const selected = Math.max(
    0,
    evidence.scenes.findIndex((s) => s.id === filters.sceneId),
  );
  const scene = evidence.scenes[selected];
  if (!scene)
    return (
      <StatusPanel status="empty" title="No hay escenas publicadas para esta área">
        <p>El snapshot existe, pero no contiene adquisiciones válidas.</p>
      </StatusPanel>
    );
  const compared = evidence.scenes.find((s) => s.id === filters.compareId) ?? null;
  const lst = variable === "lst";
  const date = scene.acquired_at.slice(0, 10);
  const mean = lst ? scene.lst_mean : scene.ndvi_mean;
  return (
    <>
      <section className="stage" aria-label={`Valle de Cochabamba, ${date}`}>
        <StudyMap
          scene={scene}
          variable={variable}
          bounds={evidence.bounds}
          overlays={overlays}
          onOverlayError={overlayFailed}
        />
        <div className="hud">
          <div className="hud-context"><span className="observatory-mark" aria-hidden="true" />Ventana piloto de Cochabamba</div>
          <p className="hud-date">
            <time dateTime={scene.acquired_at}>{date}</time>, {scene.platform}
          </p>
          <p className="hud-value">
            {mean == null ? "Sin datos" : mean.toFixed(lst ? 1 : 3)}
            {mean != null && lst && <small> °C</small>}
          </p>
          <p className="hud-label">
            {lst ? "Temperatura superficial media" : "NDVI medio"} de los píxeles válidos
          </p>
          <div className="legend">
            <span>{lst ? "0 °C" : "−1"}</span>
            <div className={lst ? "gradient heat" : "gradient green"} />
            <span>{lst ? "50 °C" : "1"}</span>
          </div>
          <p className="hud-note">
            Escala fija para todas las fechas. En 3D, la altura de cada columna
            repite el mismo valor (tope de escala = 900 m) y el relieve es la
            elevación real exagerada ×1,5. Celdas de unos 360 m; los huecos no
            tienen datos.
          </p>
        </div>
      </section>
      <SceneTimeline scenes={evidence.scenes} selectedId={scene.id}
        onSelect={(sceneId) => update({ sceneId })} />
      {notices.length > 0 && (
        <div className="link-notice" role="status">
          <p>Algunos filtros del enlace no se pudieron aplicar:</p>
          <ul>
            {notices.map((notice) => (
              <li key={notice}>{notice}</li>
            ))}
          </ul>
        </div>
      )}
      <section className="controls" aria-label="Filtros">
        <div className="field">
          <label htmlFor="scene">Fecha de adquisición</label>
          <select
            id="scene"
            value={scene.id}
            onChange={(e) => update({ sceneId: e.target.value })}
          >
            {evidence.scenes.map((s) => (
              <option key={s.id} value={s.id}>
                {s.acquired_at.slice(0, 10)}, {s.platform}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="compare">Comparar con</label>
          <select
            id="compare"
            value={filters.compareId ?? ""}
            disabled={evidence.scenes.length < 2}
            onChange={(e) => update({ compareId: e.target.value || null })}
          >
            <option value="">Sin comparación</option>
            {evidence.scenes
              .filter((s) => s.id !== scene.id)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.acquired_at.slice(0, 10)}, {s.platform}
                </option>
              ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="variable">Variable</label>
          <select
            id="variable"
            value={variable}
            onChange={(e) => update({ variable: e.target.value as Variable })}
          >
            <option value="lst">Temperatura superficial (LST)</option>
            <option value="ndvi">Índice de vegetación (NDVI)</option>
          </select>
        </div>
        <div className="field">
          <span className="field-label">Compartir</span>
          <button type="button" onClick={copyLink}>
            Copiar enlace a esta vista
          </button>
          <small aria-live="polite">
            {copy === "copied"
              ? "Enlace copiado. Incluye territorio, fechas y variable."
              : copy === "failed"
                ? "No se pudo copiar. Copia la dirección del navegador; ya incluye los filtros."
                : "El enlace conserva territorio, fechas y variable."}
          </small>
          <Link href={`/informes?contenido=escenas&escena=${encodeURIComponent(scene.id)}`}>
            Descargar los datos de esta fecha
          </Link>
        </div>
      </section>
      <section className="metrics" aria-label={`Indicadores del ${date}`}>
        <Metric label="LST media válida" value={scene.lst_mean} unit="°C" digits={1}>
          Temperatura de la superficie al paso del satélite
        </Metric>
        <Metric label="NDVI medio válido" value={scene.ndvi_mean} digits={3}>
          Índice sin unidad, de −1 a 1
        </Metric>
        <Metric
          label="Cobertura válida"
          value={scene.valid_fraction * 100}
          unit="%"
          digits={1}
        >
          {scene.valid_pixels.toLocaleString("es-BO")} de{" "}
          {scene.total_pixels.toLocaleString("es-BO")} píxeles
        </Metric>
        <article className="metric">
          <p className="metric-label">Naturaleza del dato</p>
          <NatureBadge nature={synthetic ? "synthetic" : "observed"} detailed />
        </article>
      </section>
      <div className="territory">
        <TerritorySelector
          options={territoryOptions(evidence, catalog)}
          value={filters.territory}
          onChange={(territory) => update({ territory })}
        />
        <TerritoryCard evidence={evidence} />
      </div>
      <div className="workspace">
        <Panel title="Capas de referencia" meta={date} className="map-panel">
          <p className="caption">
            El rectángulo de celdas es una ventana de estudio, no un límite
            municipal ni distrital.
          </p>
          <MapLayers
            layers={catalog?.wms_layers ?? []}
            catalogError={!catalog}
            active={overlays}
            failed={failedOverlays}
            onToggle={toggleOverlay}
          />
        </Panel>
        <aside className="panel">
          <h2>Cómo leer estas cifras</h2>
          <p>
            Cada valor corresponde a un día concreto de julio. Las diferencias entre
            fechas pueden deberse al clima de ese día y a las condiciones de
            adquisición.
          </p>
          <div className="note">
            La temperatura superficial no equivale a la temperatura del aire.
          </div>
          <h3>¿Hay una tendencia?</h3>
          <TrendStatus trends={trends} variable={variable} />
          <h3>Calidad de esta escena</h3>
          <p className={scene.valid_fraction < 0.7 ? "warning" : undefined}>
            {scene.valid_fraction === 0
              ? "Esta escena no tiene píxeles válidos: no hay valores que interpretar."
              : scene.valid_fraction < 0.7
                ? "Cobertura reducida: interpreta estos valores con especial cautela."
                : "Revisa siempre la cobertura válida y las limitaciones del producto."}
          </p>
        </aside>
      </div>
      {compared && <ComparisonPanel first={scene} second={compared} />}
      <Panel
        title="Observaciones en el tiempo"
        meta={`${lst ? "LST en °C" : "NDVI sin unidad"}, media de píxeles válidos`}
        className="history"
      >
        <ObservationChart scenes={evidence.scenes} variable={variable} selectedId={scene.id} />
        <div className="table-wrap">
          <table>
            <caption>
              Comparación descriptiva entre adquisiciones, con todos los valores
              disponibles
            </caption>
            <thead>
              <tr>
                <th scope="col">Fecha (UTC)</th>
                <th scope="col">LST (°C)</th>
                <th scope="col">NDVI</th>
                <th scope="col">Cobertura válida</th>
              </tr>
            </thead>
            <tbody>
              {evidence.scenes.map((s) => (
                <tr key={s.id} aria-current={s.id === scene.id ? "true" : undefined}>
                  <td>{s.acquired_at.slice(0, 10)}</td>
                  <td>{format(s.lst_mean)}</td>
                  <td>{format(s.ndvi_mean, 3)}</td>
                  <td>{format(s.valid_fraction * 100, 1)} %</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <SeriesStatus series={series} />
      </Panel>
      <ProvenancePanel evidence={evidence} scene={scene} synthetic={synthetic} />
    </>
  );
}
