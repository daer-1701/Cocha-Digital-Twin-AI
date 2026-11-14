"use client";

import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { components } from "@cocha/shared";
import type { Variable } from "../lib/filters";

type Scene = components["schemas"]["Scene"];
export type MapMode = "3d" | "2d";

const OVERLAY_PREFIX = "wms-";
// Fixed scientific scales: same colors for every date, never auto-scaled.
const SCALE: Record<Variable, [number, number]> = { lst: [0, 50], ndvi: [-1, 1] };
const FILL: Record<Variable, maplibregl.ExpressionSpecification> = {
  lst: ["interpolate", ["linear"], ["get", "value"], 0, "#2357a6", 25, "#ffe9a1", 50, "#d43d42"],
  ndvi: ["interpolate", ["linear"], ["get", "value"], -1, "#896a54", 0, "#efe3be", 1, "#087b53"],
};
/** Column height in metres for the top of the fixed scale. Encodes the value, not terrain.
 * The legend in explorer.tsx repeats both numbers; keep them in sync. */
const COLUMN_MAX_M = 900;
const TERRAIN_EXAGGERATION = 1.5;
const TERRARIUM = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png";
const TERRAIN_ATTRIBUTION =
  'Elevación: <a href="https://registry.opendata.aws/terrain-tiles/">Terrain Tiles, AWS Open Data</a>';
const VIEW_3D = { pitch: 62, bearing: -24 };

function supportsWebGL(): boolean {
  const canvas = document.createElement("canvas");
  return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
}

function reducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function initialMode(): MapMode {
  const nav = navigator as Navigator & { connection?: { saveData?: boolean } };
  const weak = (nav.hardwareConcurrency ?? 4) <= 2 || nav.connection?.saveData === true;
  return weak ? "2d" : "3d";
}

function cellFeatures(
  scene: Scene,
  variable: Variable,
  inset = 0,
): Parameters<maplibregl.GeoJSONSource["setData"]>[0] {
  const [min, max] = SCALE[variable];
  return {
    type: "FeatureCollection",
    features: scene.cells
      .filter((c) => c[variable] !== null)
      .map((c) => {
        const value = c[variable] as number;
        const [w, s, e, n] = c.bounds;
        const dx = (e - w) * inset;
        const dy = (n - s) * inset;
        return {
          type: "Feature",
          properties: {
            value,
            height: Math.min(1, Math.max(0, (value - min) / (max - min))) * COLUMN_MAX_M,
          },
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [w + dx, s + dy],
                [e - dx, s + dy],
                [e - dx, n - dy],
                [w + dx, n - dy],
                [w + dx, s + dy],
              ],
            ],
          },
        };
      }),
  };
}

const round = (n: number) => Number(n.toFixed(5));

function setGrowth(map: maplibregl.Map, factor: number) {
  map.setPaintProperty("cells-3d", "fill-extrusion-height", [
    "*",
    ["get", "height"],
    factor,
  ]);
}

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
  const [mode, setMode] = useState<MapMode>(initialMode);
  const modeRef = useRef(mode);
  const introDone = useRef(false);
  const [loaded, setLoaded] = useState(false);
  const [baseError, setBaseError] = useState(false);
  // Rendered only in the browser (dynamic import with ssr: false).
  const [unsupported] = useState(() => !supportsWebGL());
  const [west, south, east, north] = bounds;
  const overlayKey = overlays.join(",");

  useEffect(() => {
    variableRef.current = variable;
    overlayErrorRef.current = onOverlayError;
    modeRef.current = mode;
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
            dem: {
              type: "raster-dem",
              tiles: [TERRARIUM],
              encoding: "terrarium",
              tileSize: 256,
              maxzoom: 14,
              attribution: TERRAIN_ATTRIBUTION,
            },
            shade: {
              type: "raster-dem",
              tiles: [TERRARIUM],
              encoding: "terrarium",
              tileSize: 256,
              maxzoom: 14,
            },
          },
          sky: {
            "sky-color": "#0d2233",
            "horizon-color": "#3b5b6b",
            "fog-color": "#0b1419",
            "sky-horizon-blend": 0.6,
            "horizon-fog-blend": 0.4,
            "fog-ground-blend": 0.75,
            "atmosphere-blend": 0.6,
          },
          layers: [
            {
              id: "base",
              type: "raster",
              source: "osm",
              paint: { "raster-saturation": -0.85, "raster-brightness-max": 0.5 },
            },
            {
              id: "hillshade",
              type: "hillshade",
              source: "shade",
              paint: {
                "hillshade-exaggeration": 0.55,
                "hillshade-shadow-color": "#05090c",
                "hillshade-highlight-color": "#9fc4cf",
                "hillshade-accent-color": "#1d3540",
              },
            },
          ],
        },
        bounds: [
          [west, south],
          [east, north],
        ],
        fitBoundsOptions: { padding: 60 },
        maxZoom: 16,
        maxPitch: 78,
      });
    } catch {
      return;
    }
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
    map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-right");
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
      map.addSource("evidence-3d", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer({
        id: "cells",
        type: "fill",
        source: "evidence",
        paint: { "fill-opacity": 0.74 },
      });
      map.addLayer({
        id: "cells-3d",
        type: "fill-extrusion",
        source: "evidence-3d",
        paint: {
          "fill-extrusion-opacity": 0.88,
          "fill-extrusion-height": 0,
          "fill-extrusion-vertical-gradient": true,
        },
      });
      const popup = (event: maplibregl.MapLayerMouseEvent) => {
        const value = event.features?.[0]?.properties?.value;
        const lst = variableRef.current === "lst";
        if (typeof value === "number")
          new maplibregl.Popup()
            .setLngLat(event.lngLat)
            .setText(
              `${lst ? "LST" : "NDVI"}: ${value.toFixed(2)}${lst ? " °C" : ""}, media de celda`,
            )
            .addTo(map);
      };
      map.on("click", "cells", popup);
      map.on("click", "cells-3d", popup);
      for (const layer of ["cells", "cells-3d"]) {
        map.on("mouseenter", layer, () => (map.getCanvas().style.cursor = "pointer"));
        map.on("mouseleave", layer, () => (map.getCanvas().style.cursor = ""));
      }
      mapRef.current = map;
      setLoaded(true);
    });
    return () => {
      mapRef.current = null;
      introDone.current = false;
      setLoaded(false);
      map.remove();
    };
  }, [west, south, east, north, unsupported]);

  // Data and colours, with columns growing from the ground when the user changes them.
  useEffect(() => {
    const map = mapRef.current;
    if (!loaded || !map) return;
    (map.getSource("evidence") as maplibregl.GeoJSONSource).setData(
      cellFeatures(scene, variable),
    );
    // Small inset so neighbouring columns read as separate cells; 2D keeps full cells.
    (map.getSource("evidence-3d") as maplibregl.GeoJSONSource).setData(
      cellFeatures(scene, variable, 0.06),
    );
    map.setPaintProperty("cells", "fill-color", FILL[variable]);
    map.setPaintProperty("cells-3d", "fill-extrusion-color", FILL[variable]);
    if (modeRef.current !== "3d" || reducedMotion()) {
      setGrowth(map, 1);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const delay = introDone.current ? 0 : 900;
    const duration = introDone.current ? 700 : 2200;
    const tick = (now: number) => {
      const t = Math.min(1, Math.max(0, (now - start - delay) / duration));
      setGrowth(map, 1 - (1 - t) ** 3);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [loaded, scene, variable]);

  // Relief and camera.
  useEffect(() => {
    const map = mapRef.current;
    if (!loaded || !map) return;
    const three = mode === "3d";
    map.setTerrain(three ? { source: "dem", exaggeration: TERRAIN_EXAGGERATION } : null);
    map.setLayoutProperty("cells", "visibility", three ? "none" : "visible");
    map.setLayoutProperty("cells-3d", "visibility", three ? "visible" : "none");
    const target = three ? VIEW_3D : { pitch: 0, bearing: 0 };
    if (reducedMotion()) map.jumpTo(target);
    else if (three && !introDone.current) {
      map.flyTo({
        ...target,
        center: [(west + east) / 2, (south + north) / 2],
        // Leave room for the floating summary panel on wide screens.
        offset: window.innerWidth > 900 ? [180, 30] : [0, 0],
        zoom: map.getZoom() - 0.7,
        duration: 4200,
        curve: 1.2,
        essential: false,
      });
    } else map.easeTo({ ...target, duration: 1100 });
    introDone.current = true;
  }, [loaded, mode, west, south, east, north]);

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
          map.addLayer(
            {
              id: sourceId,
              type: "raster",
              source: sourceId,
              paint: { "raster-opacity": 0.85, "raster-fade-duration": 0 },
            },
            "cells",
          );
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
      <div className="mode-switch" role="group" aria-label="Vista del mapa">
        <button type="button" aria-pressed={mode === "3d"} onClick={() => setMode("3d")}>
          Relieve 3D
        </button>
        <button type="button" aria-pressed={mode === "2d"} onClick={() => setMode("2d")}>
          Plano 2D
        </button>
      </div>
      {baseError && (
        <p className="map-warning" role="status">
          No se pudo cargar parte del mapa. La tabla sigue disponible.
        </p>
      )}
      <noscript>Consulta la tabla de observaciones.</noscript>
    </div>
  );
}
