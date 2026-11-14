"use client";

import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { components } from "@cocha/shared";
import type { Variable } from "../lib/filters";
import {
  GAMC_BLOCKS_ID,
  GAMC_DISTRICTS_ID,
  GAMC_EXTENT,
  insideExtent,
  intersectsExtent,
  type FeatureInfoResponse,
  type FeatureProperties,
} from "../lib/gamc";

type Scene = components["schemas"]["Scene"];
export type MapMode = "3d" | "2d";
type Place = {
  status: "loading" | "ready" | "outside" | "error";
  district?: FeatureProperties | null;
  block?: FeatureProperties | null;
};

// Small box around the click so the queried pixel sits on the clicked point.
const INFO_HALF_DEG = 0.0005;
const INFO_SIZE = 101;

const text = (value: string | number | null | undefined) =>
  value == null || value === "" ? "Sin datos" : String(value);

async function featureAt(
  serviceId: string,
  lng: number,
  lat: number,
  signal: AbortSignal,
): Promise<FeatureProperties | null> {
  const bbox = [lng - INFO_HALF_DEG, lat - INFO_HALF_DEG, lng + INFO_HALF_DEG, lat + INFO_HALF_DEG];
  const query = new URLSearchParams({
    service_id: serviceId,
    bbox: bbox.map((n) => n.toFixed(6)).join(","),
    width: String(INFO_SIZE),
    height: String(INFO_SIZE),
    x: String((INFO_SIZE - 1) / 2),
    y: String((INFO_SIZE - 1) / 2),
  });
  const response = await fetch(`/api/gamc/wms/feature-info?${query}`, { signal });
  const body = (await response.json()) as FeatureInfoResponse;
  if (body.status === "unavailable") throw new Error(body.reason);
  return body.features[0] ?? null;
}

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
  return weak || reducedMotion() ? "2d" : "3d";
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
      .map((c, index) => ({ ...c, index }))
      .filter((c) => c[variable] !== null)
      .map((c) => {
        const value = c[variable] as number;
        const [w, s, e, n] = c.bounds;
        const dx = (e - w) * inset;
        const dy = (n - s) * inset;
        return {
          type: "Feature",
          properties: {
            index: c.index,
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
  synthetic = false,
  placeInfo = false,
}: {
  scene: Scene;
  variable: Variable;
  bounds: number[];
  /** Allowlisted GAMC service ids to draw as reference images. */
  overlays?: string[];
  onOverlayError?: (serviceId: string) => void;
  synthetic?: boolean;
  /** Query GAMC district and block attributes on click. */
  placeInfo?: boolean;
}) {
  const container = useRef<HTMLDivElement>(null);
  const shell = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const overlayErrorRef = useRef(onOverlayError);
  const [mode, setMode] = useState<MapMode>(initialMode);
  const modeRef = useRef(mode);
  const introDone = useRef(false);
  const [loaded, setLoaded] = useState(false);
  const [baseError, setBaseError] = useState(false);
  const [initError, setInitError] = useState(false);
  const [orbiting, setOrbiting] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [fullscreenError, setFullscreenError] = useState(false);
  const [picked, setPicked] = useState<{ sceneId: string; index: number } | null>(null);
  const [place, setPlace] = useState<Place | null>(null);
  const [outsideCoverage, setOutsideCoverage] = useState(false);
  const placeRequest = useRef<AbortController | null>(null);
  const sceneRef = useRef(scene.id);
  // Rendered only in the browser (dynamic import with ssr: false).
  const [unsupported] = useState(() => !supportsWebGL());
  const [west, south, east, north] = bounds;
  const overlayKey = overlays.join(",");

  const lookup = (lng: number, lat: number) => {
    placeRequest.current?.abort();
    placeRequest.current = null;
    if (!placeInfo) return setPlace(null);
    if (!insideExtent(lng, lat)) return setPlace({ status: "outside" });
    const controller = new AbortController();
    placeRequest.current = controller;
    setPlace({ status: "loading" });
    Promise.all([
      featureAt(GAMC_DISTRICTS_ID, lng, lat, controller.signal),
      featureAt(GAMC_BLOCKS_ID, lng, lat, controller.signal),
    ])
      .then(([district, block]) => {
        if (!controller.signal.aborted) setPlace({ status: "ready", district, block });
      })
      .catch(() => {
        if (!controller.signal.aborted) setPlace({ status: "error" });
      });
  };
  const lookupRef = useRef(lookup);
  const closeDetail = () => {
    placeRequest.current?.abort();
    setPicked(null);
    setPlace(null);
  };

  useEffect(() => {
    overlayErrorRef.current = onOverlayError;
    modeRef.current = mode;
    sceneRef.current = scene.id;
    lookupRef.current = lookup;
  });

  useEffect(() => () => placeRequest.current?.abort(), []);

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
      queueMicrotask(() => setInitError(true));
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
      map.on("click", (event) => {
        const layer = modeRef.current === "3d" ? "cells-3d" : "cells";
        const index = map.queryRenderedFeatures(event.point, { layers: [layer] })[0]?.properties
          ?.index;
        setPicked(typeof index === "number" ? { sceneId: sceneRef.current, index } : null);
        lookupRef.current(event.lngLat.lng, event.lngLat.lat);
      });
      const coverage = () => {
        const view = map.getBounds();
        setOutsideCoverage(
          !intersectsExtent([view.getWest(), view.getSouth(), view.getEast(), view.getNorth()]),
        );
      };
      coverage();
      map.on("moveend", coverage);
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

  // Camera rotation is opt-in and stops as soon as the visitor takes control.
  useEffect(() => {
    const map = mapRef.current;
    if (!loaded || !map || !orbiting || mode !== "3d") return;
    let frame = 0;
    let previous = performance.now();
    const stop = () => setOrbiting(false);
    const visibility = () => { if (document.hidden) stop(); };
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const tick = (now: number) => {
      map.jumpTo({ bearing: map.getBearing() + Math.min(now - previous, 50) * 0.003 });
      previous = now;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    const canvas = map.getCanvas();
    canvas.addEventListener("pointerdown", stop);
    canvas.addEventListener("wheel", stop);
    canvas.addEventListener("keydown", stop);
    document.addEventListener("visibilitychange", visibility);
    motion.addEventListener("change", stop);
    return () => {
      cancelAnimationFrame(frame);
      canvas.removeEventListener("pointerdown", stop);
      canvas.removeEventListener("wheel", stop);
      canvas.removeEventListener("keydown", stop);
      document.removeEventListener("visibilitychange", visibility);
      motion.removeEventListener("change", stop);
    };
  }, [loaded, orbiting, mode]);

  useEffect(() => {
    const changed = () => {
      setFullscreen(document.fullscreenElement === shell.current);
      mapRef.current?.resize();
    };
    document.addEventListener("fullscreenchange", changed);
    const observer = new ResizeObserver(() => mapRef.current?.resize());
    if (shell.current) observer.observe(shell.current);
    return () => { document.removeEventListener("fullscreenchange", changed); observer.disconnect(); };
  }, []);

  const resetCamera = () => {
    setOrbiting(false);
    mapRef.current?.fitBounds([[west, south], [east, north]], {
      padding: 65, ...(mode === "3d" ? VIEW_3D : { pitch: 0, bearing: 0 }),
      duration: reducedMotion() ? 0 : 1200,
    });
  };
  const showCoverage = () => {
    setOrbiting(false);
    const [w, s, e, n] = GAMC_EXTENT;
    mapRef.current?.fitBounds([[w, s], [e, n]], {
      padding: 40, ...(mode === "3d" ? VIEW_3D : { pitch: 0, bearing: 0 }),
      duration: reducedMotion() ? 0 : 1200,
    });
  };
  const toggleFullscreen = async () => {
    setFullscreenError(false);
    try {
      if (document.fullscreenElement === shell.current) await document.exitFullscreen();
      else await shell.current?.requestFullscreen();
    } catch { setFullscreenError(true); }
  };
  const inspected = picked?.sceneId === scene.id ? scene.cells[picked.index] : null;

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

  if (unsupported || initError)
    return (
      <div className="map-placeholder" role="status">
        Este navegador no puede mostrar el mapa (WebGL no disponible). Los valores
        están en la tabla «Observaciones en el tiempo».
      </div>
    );
  return (
    <div className="map-shell" ref={shell}>
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
        <button type="button" aria-pressed={mode === "2d"} onClick={() => { setOrbiting(false); setMode("2d"); }}>
          Plano 2D
        </button>
      </div>
      <div className="camera-tools" role="group" aria-label="Explorar el valle">
        <button type="button" disabled={!loaded || mode !== "3d"} aria-pressed={orbiting}
          onClick={() => setOrbiting(!orbiting)}>{orbiting ? "Detener giro" : "Girar el valle"}</button>
        <button type="button" disabled={!loaded} onClick={resetCamera}>Centrar vista</button>
        {(overlayKey || placeInfo) && (
          <button type="button" disabled={!loaded} onClick={showCoverage}>Cobertura GAMC</button>
        )}
        <button type="button" onClick={toggleFullscreen}>{fullscreen ? "Salir de pantalla completa" : "Pantalla completa"}</button>
      </div>
      <div className="map-evidence-label">
        <strong>{synthetic ? "Demo sintética" : "Observación Landsat"}</strong>
        <span>{scene.acquired_at.slice(0, 10)} · {variable === "lst" ? "LST: 0–50 °C" : "NDVI: −1 a 1"}</span>
        {fullscreen && <small>Altura de columnas: valor representado, hasta 900 m. Relieve ×1,5. Pulsa una celda para consultar sus valores.</small>}
      </div>
      {!loaded && <p className="map-loading" role="status">Preparando el relieve y las observaciones…</p>}
      {fullscreenError && <p className="map-warning" role="status">El navegador no permite pantalla completa en esta ventana.</p>}
      {(inspected || place) && (
        <aside className="cell-inspector" aria-label={inspected ? "Celda seleccionada" : "Punto seleccionado"}>
          <div>
            <strong>{inspected ? "Detalle de la superficie" : "Contexto municipal"}</strong>
            <button type="button" onClick={closeDetail} aria-label={inspected ? "Cerrar detalle de celda" : "Cerrar detalle del punto"}>×</button>
          </div>
          {inspected && (
            <>
              <p>{scene.acquired_at.slice(0, 10)} · Media de celda</p>
              <dl>
                <div><dt>LST</dt><dd>{inspected.lst == null ? "Sin datos" : `${inspected.lst.toFixed(1)} °C`}</dd></div>
                <div><dt>NDVI</dt><dd>{inspected.ndvi == null ? "Sin datos" : inspected.ndvi.toFixed(3)}</dd></div>
              </dl>
              <small>Temperatura de la superficie. La altura de la columna es una representación del valor.</small>
            </>
          )}
          {place && (
            <section className="place-context" aria-live="polite">
              {inspected && <strong>Contexto municipal</strong>}
              {place.status === "loading" && <p>Consultando las capas del GAMC…</p>}
              {place.status === "outside" && <p>Este punto está fuera de la cobertura publicada de las capas GAMC.</p>}
              {place.status === "error" && <p>No se pudo consultar el servicio municipal en este punto.</p>}
              {place.status === "ready" && (
                <>
                  <dl>
                    <div><dt>Distrito</dt><dd>{text(place.district?.Distrito)}</dd></div>
                    <div><dt>Comuna</dt><dd>{text(place.district?.Comuna)}</dd></div>
                    <div><dt>Personas en la manzana</dt><dd>{text(place.block?.Personas)}</dd></div>
                    <div><dt>Viviendas</dt><dd>{text(place.block?.Viviendas)}</dd></div>
                    <div><dt>Densidad</dt><dd>{text(place.block?.Densidad)}</dd></div>
                  </dl>
                  <small>
                    Fuente: GAMC, consulta WMS por punto. El servicio no publica el año
                    del dato ni las unidades de superficie y densidad. Es contexto: no se
                    usa para calcular ni explicar LST o NDVI.
                  </small>
                </>
              )}
            </section>
          )}
        </aside>
      )}
      {overlayKey && outsideCoverage && (
        <p className="map-warning" role="status">
          La vista está fuera de la cobertura de las capas GAMC.{" "}
          <button type="button" onClick={showCoverage}>Ir a la cobertura</button>
        </p>
      )}
      {baseError && (
        <p className="map-warning" role="status">
          No se pudo cargar parte del mapa. La tabla sigue disponible.
        </p>
      )}
      <noscript>Consulta la tabla de observaciones.</noscript>
    </div>
  );
}
