"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import {
  explainDistrictEvidence,
  type DistrictSeriesResult,
  type ExplainResult,
  type WeatherReading,
} from "../app/map-actions";
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
        Demo: elige un distrito → en la ficha pulsa «Qué puede hacer la Alcaldía aquí (IA)» →
        la IA propone acciones concretas citando evidencia, sin inventar cifras.
      </p>
    </aside>
  );
}

function weatherNoteFrom(weather: WeatherReading | null): string | null {
  if (!weather) return null;
  return [
    `aire ${weather.temperature.toFixed(1)} °C`,
    `sensación ${weather.apparent.toFixed(1)} °C`,
    `humedad ${weather.humidity}%`,
    `viento ${weather.wind.toFixed(0)} km/h`,
    `lluvia ${weather.rain.toFixed(1)} mm`,
    weather.time,
  ].join("; ");
}

type DistrictBriefProps = {
  districtName: string;
  districtNumber: number;
  boundaryVersion: string;
  series: DistrictSeriesResult | { status: "loading" } | null;
  weather: WeatherReading | null;
};

export function DistrictMunicipalBrief({
  districtName,
  districtNumber,
  boundaryVersion,
  series,
  weather,
}: DistrictBriefProps) {
  const [busy, setBusy] = useState(false);
  const [advice, setAdvice] = useState<ExplainResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => {
      if (!cancelled) {
        setAdvice(null);
        setBusy(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [districtNumber, boundaryVersion]);

  async function askAi(focus: "acciones" | "visita" | "datos" = "acciones") {
    setBusy(true);
    try {
      const result = await explainDistrictEvidence({
        districtNumber,
        boundaryVersion,
        weatherNote: weatherNoteFrom(weather),
        focus,
      });
      setAdvice(result);
    } catch {
      setAdvice({
        answer: null,
        message: "No se pudo consultar la IA para este distrito.",
      });
    } finally {
      setBusy(false);
    }
  }

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

  const empty = series.status === "unavailable" || series.items.length === 0;
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
          Microclima · Alcaldía + IA · Distrito {districtNumber}
        </span>
        <strong>{districtName}</strong>
        <p>
          La inteligencia artificial es el apoyo principal: sugiere qué puede hacer el
          equipo municipal en este distrito con la evidencia publicada.
        </p>
      </header>

      <section className="municipal-ai-panel" aria-label="Sugerencias de la IA">
        <div className="municipal-ai-head">
          <strong>Qué puede hacer la Alcaldía aquí</strong>
          <p>
            La IA prioriza acciones (visitas, inventario verde/sombra, comparación,
            expediente) según la evidencia del servidor. No decide sola ni inventa
            mediciones.
          </p>
        </div>
        <div className="municipal-ai-actions">
          <button
            type="button"
            className="municipal-ai-primary"
            disabled={busy}
            onClick={() => askAi("acciones")}
          >
            {busy
              ? "La IA está preparando sugerencias…"
              : advice
                ? "Actualizar sugerencias de la IA"
                : "Qué puede hacer la Alcaldía aquí (IA)"}
          </button>
          <button
            type="button"
            className="municipal-ai-secondary"
            disabled={busy}
            onClick={() => askAi("visita")}
          >
            Priorizar visita de campo (IA)
          </button>
          <button
            type="button"
            className="municipal-ai-secondary"
            disabled={busy}
            onClick={() => askAi("datos")}
          >
            Qué datos faltan (IA)
          </button>
        </div>
        {advice && (
          <div className="municipal-ai-answer" role="status">
            <p className="municipal-ai-message">{advice.message}</p>
            {advice.answer ? (
              <div className="municipal-ai-body">{advice.answer}</div>
            ) : (
              <p>Sin texto de sugerencias en esta respuesta.</p>
            )}
            {advice.citations && advice.citations.length > 0 && (
              <ul>
                {advice.citations.map((citation) => (
                  <li key={citation.id}>
                    {citation.title}
                    {citation.source ? ` · ${citation.source}` : ""}
                  </li>
                ))}
              </ul>
            )}
            {(advice.spent_usd != null || advice.model) && (
              <small>
                {advice.model ? `Modelo ${advice.model}. ` : ""}
                {advice.spent_usd != null
                  ? `Gasto acumulado en ledger: USD ${advice.spent_usd.toFixed(4)}.`
                  : ""}
              </small>
            )}
          </div>
        )}
      </section>

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

      <section className="municipal-actions" aria-label="Pasos base sin IA">
        <strong>Pasos base (sin gastar cuota de IA)</strong>
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
