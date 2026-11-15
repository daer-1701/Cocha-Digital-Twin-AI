"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import * as maplibregl from "maplibre-gl";
import type { components } from "@cocha/shared";
import type { Variable } from "../lib/filters";
import { cellsShareGrid } from "../lib/cell-identity";

type Scene = components["schemas"]["Scene"];

const FILL: Record<Variable, maplibregl.ExpressionSpecification> = {
  lst: ["interpolate", ["linear"], ["get", "value"], 0, "#2357a6", 25, "#ffe9a1", 50, "#d43d42"],
  ndvi: ["interpolate", ["linear"], ["get", "value"], -1, "#896a54", 0, "#efe3be", 1, "#087b53"],
};

function cellFeatures(scene: Scene, variable: Variable) {
  return {
    type: "FeatureCollection" as const,
    features: scene.cells
      .map((c, index) => ({ ...c, index }))
      .filter((c) => c[variable] !== null)
      .map((c) => {
        const value = c[variable] as number;
        const [w, s, e, n] = c.bounds;
        return {
          type: "Feature" as const,
          properties: { index: c.index, value },
          geometry: {
            type: "Polygon" as const,
            coordinates: [
              [
                [w, s],
                [e, s],
                [e, n],
                [w, n],
                [w, s],
              ],
            ],
          },
        };
      }),
  };
}

function buildMap(
  container: HTMLDivElement,
  bounds: number[],
  scene: Scene,
  variable: Variable,
): maplibregl.Map {
  const [west, south, east, north] = bounds;
  maplibregl.setWorkerUrl("/maplibre-worker.mjs");
  const map = new maplibregl.Map({
    container,
    bounds: [
      [west, south],
      [east, north],
    ],
    fitBoundsOptions: { padding: 48 },
    pitch: 0,
    bearing: 0,
    interactive: true,
    attributionControl: { compact: true },
    style: {
      version: 8,
      sources: {
        osm: {
          type: "raster",
          tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
          tileSize: 256,
          attribution: "© OpenStreetMap contributors",
        },
        evidence: { type: "geojson", data: cellFeatures(scene, variable) },
      },
      layers: [
        {
          id: "base",
          type: "raster",
          source: "osm",
          paint: { "raster-saturation": -0.7, "raster-brightness-max": 0.7 },
        },
        {
          id: "cells",
          type: "fill",
          source: "evidence",
          paint: { "fill-color": FILL[variable], "fill-opacity": 0.78 },
        },
        {
          id: "borders",
          type: "line",
          source: "evidence",
          paint: { "line-color": "#132a38", "line-width": 1, "line-opacity": 0.55 },
        },
      ],
    },
    doubleClickZoom: false,
    maxZoom: 16,
    maxPitch: 0,
  });
  map.dragRotate.disable();
  map.touchZoomRotate.disableRotation();
  return map;
}

/**
 * Side-by-side acquisition comparison with a draggable curtain.
 * Uses published cell bounds for both dates; never invents spatial values.
 */
export function CompareCurtain({
  left,
  right,
  variable,
  bounds,
  synthetic,
  onExit,
}: {
  left: Scene;
  right: Scene;
  variable: Variable;
  bounds: number[];
  synthetic: boolean;
  onExit: () => void;
}) {
  const reduced = useReducedMotion();
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const leftMap = useRef<maplibregl.Map | null>(null);
  const rightMap = useRef<maplibregl.Map | null>(null);
  const syncing = useRef(false);
  const [position, setPosition] = useState(50);
  const [ready, setReady] = useState(false);
  const [dragging, setDragging] = useState(false);
  const sliderId = useId();
  const compatible = cellsShareGrid(left.cells, right.cells);
  const lst = variable === "lst";

  useEffect(() => {
    if (!compatible || !leftRef.current || !rightRef.current) return;
    const a = buildMap(leftRef.current, bounds, left, variable);
    const b = buildMap(rightRef.current, bounds, right, variable);
    leftMap.current = a;
    rightMap.current = b;
    let pending = 2;
    const mark = () => {
      pending -= 1;
      if (pending === 0) setReady(true);
    };
    a.on("load", mark);
    b.on("load", mark);

    const mirror =
      (source: maplibregl.Map, target: maplibregl.Map) =>
      () => {
        if (syncing.current) return;
        syncing.current = true;
        const center = source.getCenter();
        const zoom = source.getZoom();
        const bearing = source.getBearing();
        target.jumpTo({ center, zoom, bearing, pitch: 0 });
        syncing.current = false;
      };
    const syncA = mirror(a, b);
    const syncB = mirror(b, a);
    a.on("move", syncA);
    b.on("move", syncB);

    return () => {
      a.off("move", syncA);
      b.off("move", syncB);
      leftMap.current = null;
      rightMap.current = null;
      a.remove();
      b.remove();
      setReady(false);
    };
    // Rebuild only when the compared pair or variable changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left.id, right.id, variable, compatible, bounds.join(",")]);

  useEffect(() => {
    const a = leftMap.current;
    const b = rightMap.current;
    if (!a || !b || !ready) return;
    (a.getSource("evidence") as maplibregl.GeoJSONSource).setData(cellFeatures(left, variable));
    (b.getSource("evidence") as maplibregl.GeoJSONSource).setData(cellFeatures(right, variable));
    a.setPaintProperty("cells", "fill-color", FILL[variable]);
    b.setPaintProperty("cells", "fill-color", FILL[variable]);
  }, [left, right, variable, ready]);

  const setFromClientX = (clientX: number, track: HTMLElement) => {
    const rect = track.getBoundingClientRect();
    const next = ((clientX - rect.left) / rect.width) * 100;
    setPosition(Math.min(100, Math.max(0, next)));
  };

  if (!compatible) {
    return (
      <section className="compare-curtain compare-curtain-blocked" aria-label="Comparación espacial">
        <p role="status">
          No se puede abrir la cortina espacial: las dos adquisiciones no comparten celdas
          georreferenciadas comparables en el contrato. Se conserva la comparación tabular de medias.
        </p>
        <button type="button" onClick={onExit}>
          Volver al mapa
        </button>
      </section>
    );
  }

  const leftDate = left.acquired_at.slice(0, 10);
  const rightDate = right.acquired_at.slice(0, 10);

  return (
    <section
      className="compare-curtain"
      aria-label="Comparación espacial por cortina"
      data-ready={ready ? "true" : "false"}
      style={{
        ["--curtain" as string]: `${position}%`,
        transition: dragging || reduced ? "none" : "opacity 240ms ease",
      }}
    >
      <div className="compare-curtain-toolbar">
        <p>
          <strong>{lst ? "LST" : "NDVI"}</strong>
          {" · "}
          <time dateTime={left.acquired_at}>{leftDate}</time>
          {" | "}
          <time dateTime={right.acquired_at}>{rightDate}</time>
          {" · "}
          escala fija {lst ? "0–50 °C" : "−1 a 1"}
        </p>
        <button type="button" onClick={onExit}>
          Salir de la cortina
        </button>
      </div>
      <div className="compare-curtain-stage">
        <div className="compare-pane compare-pane-left" style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}>
          <div ref={leftRef} className="compare-map" role="img" aria-label={`Mapa de ${leftDate}`} />
          <span className="compare-date-chip">{leftDate}</span>
        </div>
        <div className="compare-pane compare-pane-right" style={{ clipPath: `inset(0 0 0 ${position}%)` }}>
          <div ref={rightRef} className="compare-map" role="img" aria-label={`Mapa de ${rightDate}`} />
          <span className="compare-date-chip">{rightDate}</span>
        </div>
        <div
          className="compare-divider"
          style={{ left: `${position}%` }}
          onPointerDown={(event) => {
            event.preventDefault();
            const track = event.currentTarget.parentElement;
            if (!track) return;
            setDragging(true);
            const move = (e: PointerEvent) => setFromClientX(e.clientX, track);
            const up = () => {
              setDragging(false);
              window.removeEventListener("pointermove", move);
              window.removeEventListener("pointerup", up);
            };
            window.addEventListener("pointermove", move);
            window.addEventListener("pointerup", up);
            setFromClientX(event.clientX, track);
          }}
        >
          <input
            id={sliderId}
            className="compare-slider"
            type="range"
            min={0}
            max={100}
            step={1}
            value={Math.round(position)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(position)}
            aria-valuetext={`${Math.round(position)} por ciento a la izquierda muestra ${leftDate}; el resto muestra ${rightDate}`}
            aria-label={`Cortina de comparación entre ${leftDate} y ${rightDate}`}
            onChange={(event) => setPosition(Number(event.target.value))}
            onKeyDown={(event) => {
              if (event.key === "Home") {
                event.preventDefault();
                setPosition(0);
              } else if (event.key === "End") {
                event.preventDefault();
                setPosition(100);
              }
            }}
          />
        </div>
      </div>
      <section className="compare-meta" aria-label="Cobertura y procedencia de cada adquisición">
        <h3 className="compare-meta-title">Cobertura y procedencia de cada adquisición</h3>
        <div className="compare-meta-grid">
          <article data-signal="coverage">
            <h4>{leftDate}</h4>
            <p className="compare-meta-value">
              <span className="signal-chip signal-coverage">QA</span>
              {(left.valid_fraction * 100).toFixed(1)} % · {left.platform}
            </p>
            <p>
              <a href={left.source_url} target="_blank" rel="noreferrer">
                Registro STAC
                <span className="sr-only"> (se abre en una pestaña nueva)</span>
              </a>
            </p>
          </article>
          <article data-signal="coverage">
            <h4>{rightDate}</h4>
            <p className="compare-meta-value">
              <span className="signal-chip signal-coverage">QA</span>
              {(right.valid_fraction * 100).toFixed(1)} % · {right.platform}
            </p>
            <p>
              <a href={right.source_url} target="_blank" rel="noreferrer">
                Registro STAC
                <span className="sr-only"> (se abre en una pestaña nueva)</span>
              </a>
            </p>
          </article>
        </div>
        <p className="caption">
          {synthetic
            ? "Datos sintéticos: las celdas son rectángulos de demostración, no límites oficiales."
            : "Solo se muestran valores georreferenciados publicados. Los píxeles sin dato permanecen ausentes."}
        </p>
      </section>
      {!ready && (
        <p className="compare-loading" role="status">
          Preparando el par de adquisiciones…
        </p>
      )}
    </section>
  );
}
