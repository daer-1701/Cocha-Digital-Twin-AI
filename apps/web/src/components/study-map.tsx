"use client";

import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { components } from "@cocha/shared";

type Scene = components["schemas"]["Scene"];

export default function StudyMap({
  scene,
  variable,
  bounds,
}: {
  scene: Scene;
  variable: "lst" | "ndvi";
  bounds: number[];
}) {
  const container = useRef<HTMLDivElement>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!container.current) return;
    maplibregl.setWorkerUrl("/maplibre-worker.mjs");
    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({
        container: container.current,
        style: {
          version: 8,
          sources: {
            osm: {
              type: "raster",
              tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
              tileSize: 256,
              attribution: "© OpenStreetMap contributors",
            },
          },
          layers: [
            {
              id: "base",
              type: "raster",
              source: "osm",
              paint: {
                "raster-saturation": -0.8,
                "raster-brightness-max": 0.55,
              },
            },
          ],
        },
        bounds: [
          [bounds[0], bounds[1]],
          [bounds[2], bounds[3]],
        ],
        fitBoundsOptions: { padding: 25 },
        maxZoom: 16,
      });
    } catch {
      return;
    }
    map.addControl(new maplibregl.NavigationControl(), "top-right");
    map.on("error", () => setError(true));
    map.on("load", () => {
      map.addSource("evidence", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: scene.cells
            .filter((c) => c[variable] !== null)
            .map((c) => {
              const [w, s, e, n] = c.bounds;
              return {
                type: "Feature",
                properties: { value: c[variable] },
                geometry: {
                  type: "Polygon",
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
        },
      });
      map.addLayer({
        id: "cells",
        type: "fill",
        source: "evidence",
        paint: {
          "fill-opacity": 0.74,
          "fill-color":
            variable === "lst"
              ? [
                  "interpolate",
                  ["linear"],
                  ["get", "value"],
                  0,
                  "#2357a6",
                  25,
                  "#ffe9a1",
                  50,
                  "#d43d42",
                ]
              : [
                  "interpolate",
                  ["linear"],
                  ["get", "value"],
                  -1,
                  "#896a54",
                  0,
                  "#efe3be",
                  1,
                  "#087b53",
                ],
        },
      });
      map.on("click", "cells", (event) => {
        const value = event.features?.[0]?.properties?.value;
        if (typeof value === "number")
          new maplibregl.Popup()
            .setLngLat(event.lngLat)
            .setText(
              `${variable === "lst" ? "LST" : "NDVI"}: ${value.toFixed(2)}${variable === "lst" ? " °C" : ""} · media de celda`,
            )
            .addTo(map);
      });
    });
    return () => map.remove();
  }, [scene, variable, bounds]);
  return (
    <div className="map-shell">
      <div
        ref={container}
        className="study-map"
        role="region"
        aria-label="Mapa de observaciones; valores disponibles en la tabla inferior"
      />
      {error && (
        <p className="map-warning" role="status">
          No se pudo cargar una capa. Consulta la tabla.
        </p>
      )}
      <noscript>Consulta la tabla de observaciones.</noscript>
    </div>
  );
}
