"use client";

import { useMemo } from "react";
import { useReducedMotion } from "motion/react";
import type { WeatherReading } from "../app/map-actions";

export type ClimateMood = "rain" | "wind" | "heat" | "humid" | "clear";

export function climateMoodFromWeather(weather: WeatherReading): ClimateMood {
  if (weather.rain > 0.2) return "rain";
  if (weather.wind >= 25) return "wind";
  if (weather.temperature >= 28 || weather.apparent >= 30) return "heat";
  if (weather.humidity >= 70) return "humid";
  return "clear";
}

const MOOD_LABEL: Record<ClimateMood, string> = {
  rain: "Lluvia modelada",
  wind: "Viento modelado",
  heat: "Calor modelado",
  humid: "Humedad modelada",
  clear: "Condiciones secas",
};

const MOOD_HINT: Record<ClimateMood, string> = {
  rain: "Precipitación > 0 mm en el intervalo Open‑Meteo.",
  wind: "Viento a 10 m ≥ 25 km/h.",
  heat: "Aire o sensación ≥ umbral de calor.",
  humid: "Humedad relativa ≥ 70 % sin lluvia dominante.",
  clear: "Sin lluvia, viento fuerte ni calor/humedad altos.",
};

function RainLayer() {
  const drops = useMemo(
    () =>
      Array.from({ length: 48 }, (_, index) => ({
        left: `${(index * 17 + 5) % 100}%`,
        delay: `${-((index * 13) % 100) / 50}s`,
        duration: `${0.7 + (index % 5) * 0.12}s`,
        height: `${10 + (index % 4) * 4}px`,
      })),
    [],
  );
  return (
    <div className="climate-fx-rain" aria-hidden="true">
      {drops.map((drop, index) => (
        <span
          key={index}
          style={{
            left: drop.left,
            height: drop.height,
            animationDelay: drop.delay,
            animationDuration: drop.duration,
          }}
        />
      ))}
    </div>
  );
}

function WindLayer({ strong }: { strong: boolean }) {
  const streaks = useMemo(
    () =>
      Array.from({ length: strong ? 18 : 10 }, (_, index) => ({
        top: `${8 + ((index * 19) % 80)}%`,
        delay: `${-((index * 11) % 40) / 20}s`,
        duration: `${1.4 + (index % 4) * 0.25}s`,
        width: `${18 + (index % 5) * 8}%`,
      })),
    [strong],
  );
  return (
    <div className="climate-fx-wind" aria-hidden="true">
      {streaks.map((streak, index) => (
        <span
          key={index}
          style={{
            top: streak.top,
            width: streak.width,
            animationDelay: streak.delay,
            animationDuration: streak.duration,
          }}
        />
      ))}
    </div>
  );
}

function HeatLayer() {
  return <div className="climate-fx-heat" aria-hidden="true" />;
}

function HumidLayer() {
  return <div className="climate-fx-humid" aria-hidden="true" />;
}

function ClearLayer() {
  return <div className="climate-fx-clear" aria-hidden="true" />;
}

type Props = {
  weather: WeatherReading | null;
  loading: boolean;
  districtName: string;
};

export function DistrictClimateFx({ weather, loading, districtName }: Props) {
  const reduceMotion = useReducedMotion();
  const mood = weather ? climateMoodFromWeather(weather) : null;
  const windy = weather != null && weather.wind >= 18;

  return (
    <div
      className={`district-climate-fx${mood ? ` is-${mood}` : ""}${loading ? " is-loading" : ""}`}
      data-mood={mood ?? "pending"}
      aria-hidden={reduceMotion ? undefined : true}
      role={reduceMotion ? "status" : undefined}
    >
      {!reduceMotion && mood === "rain" && <RainLayer />}
      {!reduceMotion && mood === "wind" && <WindLayer strong />}
      {!reduceMotion && mood === "rain" && windy && <WindLayer strong={false} />}
      {!reduceMotion && mood === "heat" && <HeatLayer />}
      {!reduceMotion && mood === "humid" && <HumidLayer />}
      {!reduceMotion && mood === "clear" && <ClearLayer />}
      <p className="district-climate-fx-caption">
        {loading || !mood
          ? `Microclima visual · ${districtName}…`
          : `${MOOD_LABEL[mood]} · ${districtName}`}
        {mood && !loading ? (
          <span>
            {" "}
            · {MOOD_HINT[mood]} Efecto orientativo sobre el mapa; no es LST ni sensor
            distrital.
          </span>
        ) : null}
      </p>
    </div>
  );
}
