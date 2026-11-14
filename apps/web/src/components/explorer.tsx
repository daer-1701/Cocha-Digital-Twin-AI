"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { Evidence } from "../lib/api";
import {
  filtersToQuery,
  type ExplorerFilters,
  type Variable,
} from "../lib/filters";
import { territoryOptions } from "../lib/territory";
import { TerritoryCard } from "./territory-card";
import { TerritorySelector } from "./territory-selector";
import { Metric } from "./ui/metric";
import { NatureBadge } from "./ui/nature-badge";
import { Panel } from "./ui/panel";
import { StatusPanel } from "./ui/status-panel";

const StudyMap = dynamic(() => import("./study-map"), {
  ssr: false,
  loading: () => (
    <div className="map-placeholder" role="status">
      Cargando mapa…
    </div>
  ),
});
const format = (value: number | null | undefined, digits = 2) =>
  value == null ? "Sin datos" : value.toFixed(digits);

type CopyState = "idle" | "copied" | "failed";

export function Explorer({
  evidence,
  synthetic,
  initial,
  notices,
}: {
  evidence: Evidence;
  synthetic: boolean;
  initial: ExplorerFilters;
  notices: string[];
}) {
  const pathname = usePathname();
  const [filters, setFilters] = useState(initial);
  const [copy, setCopy] = useState<CopyState>("idle");
  const update = (change: Partial<ExplorerFilters>) => {
    const next = { ...filters, ...change };
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
  const lst = variable === "lst";
  const points = evidence.scenes.map((s) => (lst ? s.lst_mean : s.ndvi_mean));
  const values = points.filter((n): n is number => n !== null);
  const low = Math.min(...values),
    high = Math.max(...values);
  const x = (index: number) =>
    40 + (index * 520) / Math.max(1, points.length - 1);
  const y = (value: number) => 140 - ((value - low) / (high - low || 1)) * 100;
  const date = scene.acquired_at.slice(0, 10);
  return (
    <>
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
      <div className="territory">
        <TerritorySelector
          options={territoryOptions(evidence)}
          value={filters.territory}
          onChange={(territory) => update({ territory })}
        />
        <TerritoryCard evidence={evidence} />
      </div>
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
              ? "Enlace copiado. Incluye territorio, fecha y variable."
              : copy === "failed"
                ? "No se pudo copiar. Copia la dirección del navegador; ya incluye los filtros."
                : "El enlace conserva territorio, fecha y variable."}
          </small>
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
      <div className="workspace">
        <Panel title="Territorio observado" meta={date} className="map-panel">
          <StudyMap
            scene={scene}
            variable={variable}
            bounds={evidence.bounds}
          />
          <div className="legend">
            <span>{lst ? "0 °C" : "−1"}</span>
            <div className={lst ? "gradient heat" : "gradient green"} />
            <span>{lst ? "50 °C" : "1"}</span>
            <small>Escala fija. Celdas de unos 360 m. Los huecos no tienen datos.</small>
          </div>
          <p className="caption">
            El rectángulo es una ventana de estudio, no un límite municipal ni
            distrital.
          </p>
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
          <p>
            Aún no se puede evaluar. Hace falta una serie más larga, cobertura
            comparable y tratar la estacionalidad y la autocorrelación.
          </p>
          <h3>Calidad de esta escena</h3>
          <p>
            {scene.valid_fraction < 0.7
              ? "Cobertura reducida: interpreta estos valores con especial cautela."
              : "Revisa siempre la cobertura válida y las limitaciones del producto."}
          </p>
          <a href={scene.source_url} target="_blank" rel="noreferrer">
            Ver el registro STAC de la escena
            <span className="sr-only"> (se abre en una pestaña nueva)</span> ↗
          </a>
        </aside>
      </div>
      <Panel
        title="Observaciones en el tiempo"
        meta={`${lst ? "LST en °C" : "NDVI sin unidad"}, media de píxeles válidos`}
        className="history"
      >
        {values.length > 0 && (
          <svg
            viewBox="0 0 600 190"
            role="img"
            aria-label="Valores por fecha; puntos independientes, sin línea de tendencia"
          >
            <line x1="35" x2="570" y1="155" y2="155" className="axis" />
            {points.map(
              (v, i) =>
                v !== null && (
                  <g key={evidence.scenes[i].id}>
                    <circle
                      cx={x(i)}
                      cy={y(v)}
                      r="6"
                      className={i === selected ? "point point-selected" : "point"}
                    />
                    <text x={x(i)} y={y(v) - 14} textAnchor="middle">
                      {format(v)}
                    </text>
                    <text x={x(i)} y="180" textAnchor="middle">
                      {evidence.scenes[i].acquired_at.slice(0, 10)}
                    </text>
                  </g>
                ),
            )}
          </svg>
        )}
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
                <tr key={s.id}>
                  <td>{s.acquired_at.slice(0, 10)}</td>
                  <td>{format(s.lst_mean)}</td>
                  <td>{format(s.ndvi_mean, 3)}</td>
                  <td>{format(s.valid_fraction * 100, 1)} %</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <section className="panel provenance">
        <div>
          <h2>De dónde salen estos datos</h2>
          <p>
            {evidence.product_version}. {evidence.license}.
          </p>
          <p className="code">{scene.id}</p>
          <p>
            Snapshot generado el {evidence.generated_at.slice(0, 10)}. La ingesta
            conserva un manifiesto con sumas de verificación.
          </p>
        </div>
        <details>
          <summary>Método y limitaciones</summary>
          <p>{evidence.method}</p>
          <ul>
            {evidence.limitations.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </details>
      </section>
    </>
  );
}
