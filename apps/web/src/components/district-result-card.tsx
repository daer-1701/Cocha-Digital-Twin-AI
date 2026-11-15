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
};

export function DistrictResultCard({ series, districtName }: Props) {
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
      </div>
    );
  }

  return (
    <div className="district-result-card">
      <header>
        <strong>Indicadores de {districtName}</strong>
        <p>
          Valores zonales aceptados. Si la cobertura es baja, interpreta con cautela. LST no es
          temperatura del aire.
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
              <div className="district-metric-value">
                {formatIndicatorValue(row.value, row.units, row.variable)}
              </div>
              <div className="district-metric-body">
                <span className="district-metric-label">{meta.label}</span>
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
                      <dt>n</dt>
                      <dd>{row.n}</dd>
                    </div>
                  )}
                </dl>
                {coverage != null && (
                  <div
                    className="district-coverage"
                    aria-label={`Cobertura válida ${coverage} por ciento`}
                  >
                    <span>Cobertura {coverage}%</span>
                    <span
                      className="district-coverage-bar"
                      style={{ "--coverage": `${coverage}%` } as CSSProperties}
                    >
                      <i />
                    </span>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <small>
        Observación satelital agregada al polígono. No implica causalidad entre vegetación y
        temperatura.
      </small>
    </div>
  );
}
