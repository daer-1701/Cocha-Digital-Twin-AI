"use client";

import type { CSSProperties } from "react";
import type { DistrictSeriesResult } from "../app/map-actions";
import {
  formatIndicatorValue,
  formatPeriod,
  humanStatistic,
  humanVariable,
} from "../lib/project-guide";

type Props = {
  series: DistrictSeriesResult | { status: "loading" } | null;
  districtName: string;
  onAskAi?: () => void;
  askBusy?: boolean;
};

export function DistrictResultCard({ series, districtName, onAskAi, askBusy }: Props) {
  if (!series || series.status === "loading") {
    return (
      <div className="district-result-card" role="status">
        <strong>Leyendo indicadores de {districtName}…</strong>
        <p>Consultando solo series oficiales aceptadas en el servidor.</p>
      </div>
    );
  }

  if (series.status === "error") {
    return (
      <div className="district-result-card is-error" role="status">
        <strong>No se pudo cargar la ficha</strong>
        <p>{series.reason}</p>
      </div>
    );
  }

  if (series.status === "unavailable" || series.items.length === 0) {
    return (
      <div className="district-result-card is-empty" role="status">
        <strong>Aún no hay cifras oficiales para este polígono</strong>
        <p>
          {series.reason ||
            "La API no tiene estadísticas zonales aceptadas para este distrito y versión."}{" "}
          La media Landsat de la ventana piloto no se muestra aquí como medición distrital.
        </p>
        <ul className="district-next-steps">
          <li>Prueba otro distrito o revisa Comparar distritos.</li>
          <li>El microclima del panel derecho sigue siendo una estimación de aire (Open‑Meteo).</li>
        </ul>
      </div>
    );
  }

  return (
    <div className="district-result-card">
      <header>
        <strong>Cómo leer este distrito</strong>
        <p>
          Valores zonales aceptados para {districtName}. Cada cifra trae período, cobertura
          válida y método; si la cobertura es baja, trátala con cautela.
        </p>
      </header>
      <ul className="district-metric-list">
        {series.items.map((row) => {
          const meta = humanVariable(row.variable);
          const coverage =
            row.valid_fraction != null && Number.isFinite(row.valid_fraction)
              ? Math.round(row.valid_fraction * 100)
              : null;
          return (
            <li key={`${row.variable}-${row.statistic}-${row.period_start}-${row.period_end}`}>
              <div className="district-metric-top">
                <span className="district-metric-label">{meta.label}</span>
                <span className="district-metric-value">
                  {formatIndicatorValue(row.value, row.units, row.variable)}
                </span>
              </div>
              <p className="district-metric-gloss">{meta.gloss}</p>
              <dl className="district-metric-meta">
                <div>
                  <dt>Método</dt>
                  <dd>{humanStatistic(row.statistic)}</dd>
                </div>
                <div>
                  <dt>Período</dt>
                  <dd>{formatPeriod(row.period_start, row.period_end)}</dd>
                </div>
                {row.n != null && (
                  <div>
                    <dt>Escenas / n</dt>
                    <dd>{row.n}</dd>
                  </div>
                )}
              </dl>
              {coverage != null && (
                <div
                  className="district-coverage"
                  aria-label={`Cobertura válida ${coverage} por ciento`}
                >
                  <span>Cobertura válida {coverage}%</span>
                  <span
                    className="district-coverage-bar"
                    style={{ "--coverage": `${coverage}%` } as CSSProperties}
                  >
                    <i />
                  </span>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {onAskAi && (
        <button type="button" className="district-ask-ai" disabled={askBusy} onClick={onAskAi}>
          {askBusy ? "Interpretando…" : "Explicar esta ficha con IA"}
        </button>
      )}
      <small>
        Observación satelital agregada al polígono. No sustituye sensores de aire ni implica
        causalidad entre vegetación y temperatura.
      </small>
    </div>
  );
}
