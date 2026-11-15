"use client";

import { useEffect, useRef, useState } from "react";
import {
  explainDistrictEvidence,
  explainMapEvidence,
  loadMapWeather,
  type ExplainResult,
  type WeatherReading,
} from "../app/map-actions";

type DistrictContext = {
  number: number;
  name: string;
  boundaryVersion: string;
  latitude: number;
  longitude: number;
};

export function MapClimate({ district }: { district?: DistrictContext | null }) {
  const [weather, setWeather] = useState<WeatherReading | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [explanation, setExplanation] = useState<ExplainResult | null>(null);
  const [explanationKey, setExplanationKey] = useState("pilot");
  const weatherGen = useRef(0);
  const districtKey = district
    ? `${district.number}:${district.boundaryVersion}`
    : "pilot";
  const visibleExplanation = explanationKey === districtKey ? explanation : null;

  useEffect(() => {
    const id = ++weatherGen.current;
    let cancelled = false;
    const request =
      district != null
        ? loadMapWeather({
            latitude: district.latitude,
            longitude: district.longitude,
            scope: "district_centroid",
          })
        : loadMapWeather();
    Promise.resolve().then(() => {
      if (!cancelled && weatherGen.current === id) setLoading(true);
    });
    request
      .then((value) => {
        if (!cancelled && weatherGen.current === id) {
          setWeather(value);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled && weatherGen.current === id) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [district]);

  return (
    <details className="map-climate" open>
      <summary>
        {district
          ? `Microclimas · ${district.name}`
          : "Microclimas urbanos · clima e interpretación"}
      </summary>
      <div className="map-climate-body">
        <strong>
          {district
            ? `Tiempo modelado cerca del centroide · distrito ${district.number}`
            : "Tiempo actual · punto urbano de Cochabamba"}
        </strong>
        {loading ? (
          <p role="status">Consultando meteorología…</p>
        ) : weather ? (
          <>
            <small>
              {weather.time.replace("T", " · ")} · hora de Bolivia ·{" "}
              {weather.latitude.toFixed(3)}, {weather.longitude.toFixed(3)}
            </small>
            <dl className="climate-readings">
              <div>
                <dt>Aire a 2 m</dt>
                <dd>{weather.temperature.toFixed(1)} °C</dd>
              </div>
              <div>
                <dt>Sensación</dt>
                <dd>{weather.apparent.toFixed(1)} °C</dd>
              </div>
              <div>
                <dt>Humedad</dt>
                <dd>{weather.humidity} %</dd>
              </div>
              <div>
                <dt>Viento a 10 m</dt>
                <dd>{weather.wind} km/h</dd>
              </div>
              <div>
                <dt>Precipitación</dt>
                <dd>{weather.rain} mm</dd>
              </div>
            </dl>
            <p>
              Lectura orientativa, sin IA generativa:{" "}
              {weather.rain > 0
                ? "El modelo indica precipitación en este intervalo."
                : "El modelo no indica precipitación en este intervalo."}{" "}
              El viento y la humedad aportan contexto al intercambio de calor urbano; no
              permiten atribuir diferencias térmicas entre barrios.
            </p>
          </>
        ) : (
          <p role="status">
            Meteorología no disponible. No se sustituyen los datos por cifras inventadas.
          </p>
        )}
        <small>
          {weather?.scope === "district_centroid"
            ? "Estimación Open‑Meteo para el centroide aproximado del polígono. Varios distritos pueden caer en la misma celda del modelo y devolver valores iguales."
            : "Estimación de modelos meteorológicos para un punto de la ciudad, no sensores por celda."}{" "}
          No corresponde a la fecha histórica Landsat.{" "}
          <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">
            Fuente: Open‑Meteo
          </a>
          .
        </small>
        <hr />
        <strong>Interpretación con IA</strong>
        <p>
          {district
            ? "Consulta el asistente con la identidad territorial y los indicadores oficiales que el servidor confirme para este distrito."
            : "Consulta el asistente sobre la evidencia publicada de temperatura superficial y vegetación del piloto."}
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            const key = districtKey;
            try {
              const result = district
                ? await explainDistrictEvidence({
                    districtNumber: district.number,
                    boundaryVersion: district.boundaryVersion,
                  })
                : await explainMapEvidence();
              setExplanationKey(key);
              setExplanation(result);
            } catch {
              setExplanationKey(key);
              setExplanation({
                answer: null,
                message: "No se pudo consultar el asistente.",
              });
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy
            ? "Interpretando…"
            : district
              ? "Interpretar este distrito con IA"
              : "Interpretar evidencia con IA"}
        </button>
        {visibleExplanation && (
          <div role="status">
            <p>{visibleExplanation.message}</p>
            {visibleExplanation.answer && (
              <p style={{ whiteSpace: "pre-wrap" }}>{visibleExplanation.answer}</p>
            )}
            {visibleExplanation.citations && visibleExplanation.citations.length > 0 && (
              <ul>
                {visibleExplanation.citations.map((citation) => (
                  <li key={citation.id}>
                    {citation.title}
                    {citation.source ? ` · ${citation.source}` : ""}
                  </li>
                ))}
              </ul>
            )}
            {(visibleExplanation.spent_usd != null || visibleExplanation.model) && (
              <small>
                {visibleExplanation.model ? `Modelo ${visibleExplanation.model}. ` : ""}
                {visibleExplanation.spent_usd != null
                  ? `Gasto acumulado registrado en el ledger: USD ${visibleExplanation.spent_usd.toFixed(4)}.`
                  : ""}
              </small>
            )}
          </div>
        )}
        <small>
          LST describe la superficie; el aire requiere sensores o modelos atmosféricos. La
          vegetación puede ayudar a estudiar diferencias espaciales, pero este mapa no
          demuestra causalidad.
        </small>
      </div>
    </details>
  );
}
