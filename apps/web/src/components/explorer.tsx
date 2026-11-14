"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import type { Evidence } from "../lib/api";

const StudyMap = dynamic(() => import("./study-map"), {
  ssr: false,
  loading: () => (
    <div className="map-placeholder" role="status">
      Cargando mapa…
    </div>
  ),
});
type Variable = "lst" | "ndvi";
const format = (value: number | null | undefined, digits = 2) =>
  value == null ? "Sin datos" : value.toFixed(digits);

export function Explorer({ evidence }: { evidence: Evidence }) {
  const [selected, setSelected] = useState(evidence.scenes.length - 1);
  const [variable, setVariable] = useState<Variable>("lst");
  const scene = evidence.scenes[selected];
  if (!scene)
    return (
      <section className="empty">
        No hay escenas publicadas para esta área.
      </section>
    );
  const lst = variable === "lst";
  const points = evidence.scenes.map((s) => (lst ? s.lst_mean : s.ndvi_mean));
  const values = points.filter((n): n is number => n !== null);
  const low = Math.min(...values),
    high = Math.max(...values);
  const x = (index: number) =>
    40 + (index * 520) / Math.max(1, points.length - 1);
  const y = (value: number) => 140 - ((value - low) / (high - low || 1)) * 100;
  return (
    <>
      <section className="controls" aria-label="Filtros">
        <div>
          <label htmlFor="area">ÁREA DE ESTUDIO</label>
          <select id="area" value="pilot" onChange={() => {}}>
            <option value="pilot">Ventana urbana · Cochabamba</option>
          </select>
          <small>Distritos: pendientes de límites verificados</small>
        </div>
        <div>
          <label htmlFor="scene">FECHA DE ADQUISICIÓN</label>
          <select
            id="scene"
            value={selected}
            onChange={(e) => setSelected(Number(e.target.value))}
          >
            {evidence.scenes.map((s, i) => (
              <option key={s.id} value={i}>
                {s.acquired_at.slice(0, 10)} · {s.platform}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="variable">VARIABLE</label>
          <select
            id="variable"
            value={variable}
            onChange={(e) => setVariable(e.target.value as Variable)}
          >
            <option value="lst">Temperatura superficial (LST)</option>
            <option value="ndvi">Índice de vegetación (NDVI)</option>
          </select>
        </div>
      </section>
      <section
        className="metrics"
        aria-label="Indicadores de la fecha seleccionada"
      >
        <article>
          <p>LST MEDIA VÁLIDA</p>
          <h2>
            {format(scene.lst_mean, 1)} <small>°C</small>
          </h2>
          <span>Superficie al paso del satélite</span>
        </article>
        <article>
          <p>NDVI MEDIO VÁLIDO</p>
          <h2>{format(scene.ndvi_mean, 3)}</h2>
          <span>Índice sin unidad · −1 a 1</span>
        </article>
        <article>
          <p>COBERTURA VÁLIDA</p>
          <h2>
            {format(scene.valid_fraction * 100, 1)} <small>%</small>
          </h2>
          <span>
            {scene.valid_pixels.toLocaleString("es-BO")} /{" "}
            {scene.total_pixels.toLocaleString("es-BO")} píxeles
          </span>
        </article>
        <article>
          <p>NATURALEZA</p>
          <h2 className="observed">Observación</h2>
          <span>Sin interpolación ni predicción</span>
        </article>
      </section>
      <div className="workspace">
        <section className="panel map-panel">
          <div className="panel-title">
            <h2>Territorio observado</h2>
            <span>{scene.acquired_at.slice(0, 10)}</span>
          </div>
          <StudyMap
            scene={scene}
            variable={variable}
            bounds={evidence.bounds}
          />
          <div className="legend">
            <span>{lst ? "0 °C" : "−1"}</span>
            <div className={lst ? "gradient heat" : "gradient green"} />
            <span>{lst ? "50 °C" : "1"}</span>
            <small>Escala fija · celdas ≈ 360 m · huecos = sin datos</small>
          </div>
          <p className="caption">
            El rectángulo es una ventana de estudio. No es un límite municipal
            ni distrital.
          </p>
        </section>
        <aside className="panel">
          <p className="eyebrow">LECTURA CIENTÍFICA</p>
          <h2>Comparar sin sobreinterpretar.</h2>
          <p>
            Estas observaciones corresponden a días concretos de julio. Las
            diferencias pueden reflejar meteorología y condiciones de
            adquisición.
          </p>
          <div className="note">
            La temperatura superficial no equivale a la temperatura del aire.
          </div>
          <h3>¿Hay una tendencia?</h3>
          <p>
            Aún no evaluable. Se necesita una serie más extensa, cobertura
            comparable y tratamiento de estacionalidad y autocorrelación.
          </p>
          <h3>Calidad de esta escena</h3>
          <p>
            {scene.valid_fraction < 0.7
              ? "Cobertura reducida: interpretar con especial cautela."
              : "Consulta siempre la fracción válida y las limitaciones del producto."}
          </p>
          <a href={scene.source_url} target="_blank" rel="noreferrer">
            Ver registro STAC de la escena ↗
          </a>
        </aside>
      </div>
      <section className="panel history">
        <div className="panel-title">
          <h2>Observaciones en el tiempo</h2>
          <span>
            {lst ? "LST · °C" : "NDVI · sin unidad"} / media de píxeles válidos
          </span>
        </div>
        {values.length > 0 && (
          <svg
            viewBox="0 0 600 190"
            role="img"
            aria-label="Valores por fecha; puntos independientes, sin línea de tendencia"
          >
            <line x1="35" x2="570" y1="155" y2="155" stroke="#365064" />
            {points.map(
              (v, i) =>
                v !== null && (
                  <g key={evidence.scenes[i].id}>
                    <circle
                      cx={x(i)}
                      cy={y(v)}
                      r="6"
                      fill={i === selected ? "#65e3bb" : "#7c9ba9"}
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
              Comparación descriptiva entre adquisiciones · todos los valores
              disponibles
            </caption>
            <thead>
              <tr>
                <th>Fecha UTC</th>
                <th>LST (°C)</th>
                <th>NDVI</th>
                <th>Cobertura válida</th>
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
      </section>
      <section className="panel provenance">
        <div>
          <p className="eyebrow">TRAZABILIDAD</p>
          <h2>La fuente también es parte del resultado.</h2>
          <p>
            {evidence.product_version} · {evidence.license}
          </p>
          <p className="code">{scene.id}</p>
          <p>
            Snapshot generado: {evidence.generated_at.slice(0, 10)} · Los
            archivos de ingesta conservan manifiesto y checksums.
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
