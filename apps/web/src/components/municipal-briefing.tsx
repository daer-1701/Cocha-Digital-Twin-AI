"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import type { DistrictSeriesResult, WeatherReading } from "../app/map-actions";
import {
  briefCardsFromSeries,
  municipalNextSteps,
  MUNICIPAL_PURPOSE,
} from "../lib/municipal-briefing";

export function MunicipalPurposeBanner() {
  return (
    <aside className="municipal-purpose" aria-label="Utilidad para la Alcaldía">
      <strong>{MUNICIPAL_PURPOSE.title}</strong>
      <p>{MUNICIPAL_PURPOSE.summary}</p>
      <div className="municipal-purpose-cols">
        <div>
          <span>Sí ayuda a</span>
          <ul>
            {MUNICIPAL_PURPOSE.helps.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <div>
          <span>No hace</span>
          <ul>
            {MUNICIPAL_PURPOSE.doesNot.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>
      <p className="municipal-purpose-demo">
        Demo sugerida: elige un distrito → lee la ficha en lenguaje municipal → mira el
        microclima solo como contexto de hoy → compara o descarga para el expediente.
      </p>
    </aside>
  );
}

type DistrictBriefProps = {
  districtName: string;
  districtNumber: number;
  series: DistrictSeriesResult | { status: "loading" } | null;
  weather: WeatherReading | null;
};

export function DistrictMunicipalBrief({
  districtName,
  districtNumber,
  series,
  weather,
}: DistrictBriefProps) {
  if (!series || series.status === "loading") {
    return (
      <div className="municipal-brief" role="status">
        <strong>Preparando lectura municipal de {districtName}…</strong>
        <p>Solo se usarán indicadores oficiales aceptados en el servidor.</p>
      </div>
    );
  }

  if (series.status === "error") {
    return (
      <div className="municipal-brief is-error" role="status">
        <strong>No se pudo armar la ficha útil</strong>
        <p>{series.reason}</p>
      </div>
    );
  }

  const empty =
    series.status === "unavailable" || series.items.length === 0;
  const cards = empty ? [] : briefCardsFromSeries(series.items);
  const weakCoverage = cards.some(
    (card) => card.coveragePct != null && card.coveragePct < 50,
  );
  const steps = municipalNextSteps({
    hasIndicators: !empty,
    weakCoverage,
    weather,
  });

  return (
    <div className="municipal-brief">
      <header>
        <span className="municipal-kicker">
          Lectura para gestión · Distrito {districtNumber}
        </span>
        <strong>{districtName}</strong>
        <p>
          {empty
            ? "Todavía no hay medias zonales aceptadas para este polígono. El sistema no inventa un valor distrital a partir del piloto Landsat."
            : "Abajo: qué significa cada cifra para planificación urbana y qué puedes hacer ahora sin overclaim científico."}
        </p>
      </header>

      {!empty && (
        <ul className="municipal-card-row">
          {cards.map((card) => (
            <li key={card.id}>
              <div className="municipal-card-value">{card.value}</div>
              <div className="municipal-card-copy">
                <strong>{card.title}</strong>
                <p>{card.meaning}</p>
                <p className="municipal-use">
                  <span>Para la Alcaldía:</span> {card.useFor}
                </p>
                <p className="municipal-caution">{card.caution}</p>
                <dl>
                  <div>
                    <dt>Período</dt>
                    <dd>{card.period}</dd>
                  </div>
                  {card.coveragePct != null && (
                    <div>
                      <dt>Cobertura válida</dt>
                      <dd>
                        {card.coveragePct}%
                        <span
                          className="district-coverage-bar"
                          style={
                            {
                              "--coverage": `${card.coveragePct}%`,
                            } as CSSProperties
                          }
                          aria-hidden="true"
                        >
                          <i />
                        </span>
                      </dd>
                    </div>
                  )}
                </dl>
              </div>
            </li>
          ))}
        </ul>
      )}

      <section className="municipal-actions" aria-label="Qué puede hacer ahora">
        <strong>Qué puede hacer ahora el equipo municipal</strong>
        <ol>
          {steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        <div className="municipal-links">
          <Link href="/comparar">Comparar distritos</Link>
          <Link href="/analisis">Análisis 2014–2025</Link>
          <Link href="/informes">Descargar para informe</Link>
        </div>
      </section>
    </div>
  );
}
