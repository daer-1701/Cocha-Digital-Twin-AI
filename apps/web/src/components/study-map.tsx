"use client";

import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { components } from "@cocha/shared";
import type { Variable } from "../lib/filters";

type Scene = components["schemas"]["Scene"];

const OVERLAY_PREFIX = "wms-";
// Fixed scientific scales: same colors for every date, never auto-scaled.
const FILL: Record<Variable, maplibregl.ExpressionSpecification> = {
  lst: ["interpolate", ["linear"], ["get", "value"], 0, "#2357a6", 25, "#ffe9a1", 50, "#d43d42"],
  ndvi: ["interpolate", ["linear"], ["get", "value"], -1, "#896a54", 0, "#efe3be", 1, "#087b53"],
};

function supportsWebGL(): boolean {
  const canvas = document.createElement("canvas");
  return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
}

function cellFeatures(
  scene: Scene,
  variable: Variable,
): Parameters<maplibregl.GeoJSONSource["setData"]>[0] {
  return {
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
  };
}

const round = (n: number) => Number(n.toFixed(5));

export default function StudyMap({
  scene,
  variable,
  bounds,
  overlays = [],
  onOverlayError,
}: {
  scene: Scene;
  variable: Variable;
  bounds: number[];
  /** Allowlisted GAMC service ids to draw as reference images. */
  overlays?: string[];
  onOverlayError?: (serviceId: string) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const variableRef = useRef(variable);
  const overlayErrorRef = useRef(onOverlayError);
  const [loaded, setLoaded] = useState(false);
  const [baseError, setBaseError] = useState(false);
  // Rendered only in the browser (dynamic import with ssr: false).
  const [unsupported] = useState(() => !supportsWebGL());
  const [west, south, east, north] = bounds;
  const overlayKey = overlays.join(",");

  useEffect(() => {
    variableRef.current = variable;
    overlayErrorRef.current = onOverlayError;
  });

  useEffect(() => {
    if (!container.current || unsupported) return;
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
              paint: { "raster-saturation": -0.8, "raster-brightness-max": 0.55 },
            },
          ],
        },
        bounds: [
          [west, south],
          [east, north],
        ],
        fitBoundsOptions: { padding: 25 },
        maxZoom: 16,
      });
    } catch {
      return;
    }
    map.addControl(new maplibregl.NavigationControl(), "top-right");
    map.on("error", (event: maplibregl.ErrorEvent & { sourceId?: string }) => {
      const source = event.sourceId ?? "";
      if (source.startsWith(OVERLAY_PREFIX))
        overlayErrorRef.current?.(source.slice(OVERLAY_PREFIX.length));
      else setBaseError(true);
    });
    map.on("load", () => {
      map.addSource("evidence", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer({
        id: "cells",
        type: "fill",
        source: "evidence",
        paint: { "fill-opacity": 0.74 },
      });
      map.on("click", "cells", (event) => {
        const value = event.features?.[0]?.properties?.value;
        const lst = variableRef.current === "lst";
        if (typeof value === "number")
          new maplibregl.Popup()
            .setLngLat(event.lngLat)
            .setText(
              `${lst ? "LST" : "NDVI"}: ${value.toFixed(2)}${lst ? " °C" : ""} · media de celda`,
            )
            .addTo(map);
      });
      mapRef.current = map;
      setLoaded(true);
    });
    return () => {
      mapRef.current = null;
      setLoaded(false);
      map.remove();
    };
  }, [west, south, east, north, unsupported]);

  useEffect(() => {
    const map = mapRef.current;
    if (!loaded || !map) return;
    (map.getSource("evidence") as maplibregl.GeoJSONSource).setData(
      cellFeatures(scene, variable),
    );
    map.setPaintProperty("cells", "fill-color", FILL[variable]);
  }, [loaded, scene, variable]);

  useEffect(() => {
    const map = mapRef.current;
    if (!loaded || !map || !overlayKey) return;
    const ids = overlayKey.split(",");
    let timer: ReturnType<typeof setTimeout> | undefined;
    // One image per layer for the visible extent keeps requests within the API rate limit.
    const refresh = () => {
      const view = map.getBounds();
      const [w, s, e, n] = [
        view.getWest(),
        view.getSouth(),
        view.getEast(),
        view.getNorth(),
      ].map(round);
      const canvas = map.getCanvas();
      const width = Math.min(2048, Math.max(1, Math.round(canvas.clientWidth)));
      const height = Math.min(2048, Math.max(1, Math.round(canvas.clientHeight)));
      const coordinates: [[number, number], [number, number], [number, number], [number, number]] = [
        [w, n],
        [e, n],
        [e, s],
        [w, s],
      ];
      for (const id of ids) {
        const url = `/api/gamc/wms/map?${new URLSearchParams({
          service_id: id,
          bbox: `${w},${s},${e},${n}`,
          width: String(width),
          height: String(height),
        })}`;
        const sourceId = OVERLAY_PREFIX + id;
        const source = map.getSource(sourceId) as maplibregl.ImageSource | undefined;
        if (source) source.updateImage({ url, coordinates });
        else {
          map.addSource(sourceId, { type: "image", url, coordinates });
          map.addLayer({
            id: sourceId,
            type: "raster",
            source: sourceId,
            paint: { "raster-opacity": 0.85, "raster-fade-duration": 0 },
          });
        }
      }
    };
    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(refresh, 400);
    };
    refresh();
    map.on("moveend", schedule);
    return () => {
      clearTimeout(timer);
      if (mapRef.current !== map) return;
      map.off("moveend", schedule);
      for (const id of ids) {
        if (map.getLayer(OVERLAY_PREFIX + id)) map.removeLayer(OVERLAY_PREFIX + id);
        if (map.getSource(OVERLAY_PREFIX + id)) map.removeSource(OVERLAY_PREFIX + id);
      }
    };
  }, [loaded, overlayKey]);

  if (unsupported)
    return (
      <div className="map-placeholder" role="status">
        Este navegador no puede mostrar el mapa (WebGL no disponible). Los valores
        están en la tabla «Observaciones en el tiempo».
      </div>
    );
  return (
    <div className="map-shell">
      <div
        ref={container}
        className="study-map"
        role="region"
        aria-label="Mapa de observaciones; valores disponibles en la tabla inferior"
      />
      {baseError && (
        <p className="map-warning" role="status">
          No se pudo cargar parte del mapa. La tabla sigue disponible.
        </p>
      )}
      <noscript>Consulta la tabla de observaciones.</noscript>
    </div>
  );
}
