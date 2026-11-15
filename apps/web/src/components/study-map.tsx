"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { components } from "@cocha/shared";
import { MapClimate } from "./map-climate";
import { DistrictClimateFx } from "./district-climate-fx";
import { DistrictMunicipalBrief } from "./municipal-briefing";
import { CellCombobox } from "./cell-combobox";
import { ThemeToggle, useTheme } from "./ui/theme-provider";
import { cellKey } from "../lib/cell-identity";
import type { Variable } from "../lib/filters";
import {
  districtBounds,
  districtCentroid,
  districtFeatureCollection,
  type OfficialDistrict,
} from "../lib/districts-geojson";
import {
  loadDistrictIndicators,
  type DistrictSeriesResult,
  type WeatherReading,
} from "../app/map-actions";
import {
  GAMC_BLOCKS_ID,
  GAMC_DISTRICTS_ID,
  GAMC_EXTENT,
  insideExtent,
  intersectsExtent,
  type FeatureInfoResponse,
  type FeatureProperties,
} from "../lib/gamc";
import type { TerritoryId } from "../lib/territory";

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

function InfoFields({ items }: { items: [string, string | number | null | undefined][] }) {
  const visible = items.filter(([, value]) => value != null &&
    (typeof value === "number" ? Number.isFinite(value) : value.trim() !== "" &&
      !/^(n\/?a|no disponible|sin datos|null|undefined|-)$/i.test(value.trim())));
  if (!visible.length) return null;
  return <dl className="cell-inspector-facts">{visible.map(([label, value]) =>
    <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>;
}

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
const FILL: Record<Variable, maplibregl.ExpressionSpecification> = {
  lst: ["interpolate", ["linear"], ["get", "value"], 0, "#2357a6", 25, "#ffe9a1", 50, "#d43d42"],
  ndvi: ["interpolate", ["linear"], ["get", "value"], -1, "#896a54", 0, "#efe3be", 1, "#087b53"],
};
// Selection emphasis only: these dimensions never encode a scientific value.
const SELECTION_LIFT_M = 320;
const SELECTION_RAISE_MS = 2800;
/** Peak sideways shake of the selected cell, in screen pixels. */
const SELECTION_SHAKE_PX = 10;
const SELECTION_SHAKE_HZ = 12;
const TERRAIN_EXAGGERATION = 1.5;
const TERRARIUM = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png";
const TERRAIN_ATTRIBUTION =
  'Elevación: <a href="https://registry.opendata.aws/terrain-tiles/">Terrain Tiles, AWS Open Data</a>';
/** Esri World Imagery: realistic orthophoto basemap without a project API key. */
const SATELLITE_TILES =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const SATELLITE_ATTRIBUTION =
  'Imágenes: <a href="https://www.esri.com/">Esri</a>, Maxar, Earthstar Geographics';
type Basemap = "streets" | "satellite";
const VIEW_3D = { pitch: 55, bearing: -24 };
/** Cinematic valley entrance: brief hold → slow fly-in with place name → controls. */
const INTRO_HOLD_MS = 400;
const INTRO_FLIGHT_MS = 4200;
const INTRO_TITLE_AT_MS = 900;
const INTRO_TITLE_HOLD_MS = 1800;
const INTRO_TITLE_FADE_MS = 700;
type IntroState = "pending" | "playing" | "done";
type TitlePhase = "off" | "in" | "out";
/** Fullscreen-only cinema on enter. Never plays on exit. */
type FsCinema =
  | "idle"
  | "playing"
  | "title"
  | "hold"
  | "fade"
  | "controls"
  | "done";
const FS_RESIZE_MS = 280;
const FS_ZOOM_MS = 6000;
const FS_TITLE_IN_MS = 750;
const FS_TITLE_HOLD_MS = 3500;
const FS_TITLE_FADE_MS = 700;
const FS_CONTROLS_MS = 480;
/** Day ↔ night: brief hold, then a slow blend (not an instant flip). */
const LIGHT_DELAY_MS = 280;
const LIGHT_BLEND_MS = 1600;

type MapLight = {
  brightness: number;
  hillshade: string;
  sky: string;
  horizon: string;
  fog: string;
};

const LIGHT_DAY: MapLight = {
  brightness: 0.95,
  hillshade: "#d9e4e8",
  sky: "#b9d6e8",
  horizon: "#e4ebed",
  fog: "#d0dfe5",
};
const LIGHT_NIGHT: MapLight = {
  brightness: 0.45,
  hillshade: "#7898ad",
  sky: "#0d2233",
  horizon: "#3b5b6b",
  fog: "#0b1419",
};

function hexToRgb(hex: string): [number, number, number] {
  const raw = hex.replace("#", "");
  return [
    Number.parseInt(raw.slice(0, 2), 16),
    Number.parseInt(raw.slice(2, 4), 16),
    Number.parseInt(raw.slice(4, 6), 16),
  ];
}

function mixHex(from: string, to: string, t: number): string {
  const [fr, fg, fb] = hexToRgb(from);
  const [tr, tg, tb] = hexToRgb(to);
  const channel = (a: number, b: number) => Math.round(a + (b - a) * t);
  return `#${[channel(fr, tr), channel(fg, tg), channel(fb, tb)]
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("")}`;
}

function mixLight(from: MapLight, to: MapLight, t: number): MapLight {
  return {
    brightness: from.brightness + (to.brightness - from.brightness) * t,
    hillshade: mixHex(from.hillshade, to.hillshade, t),
    sky: mixHex(from.sky, to.sky, t),
    horizon: mixHex(from.horizon, to.horizon, t),
    fog: mixHex(from.fog, to.fog, t),
  };
}

function paintMapLight(map: maplibregl.Map, light: MapLight) {
  if (map.getLayer("base-streets")) {
    map.setPaintProperty("base-streets", "raster-brightness-max", light.brightness);
  }
  if (map.getLayer("base-satellite")) {
    // Keep orthophotos readable under the night theme without washing colours out.
    map.setPaintProperty(
      "base-satellite",
      "raster-brightness-max",
      Math.min(1, 0.55 + light.brightness * 0.45),
    );
  }
  if (map.getLayer("hillshade")) {
    map.setPaintProperty("hillshade", "hillshade-highlight-color", light.hillshade);
  }
  map.setSky({
    "sky-color": light.sky,
    "horizon-color": light.horizon,
    "fog-color": light.fog,
  });
}

function FsEnterIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="map-fs-icon">
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8 3H4v4M16 3h4v4M8 21H4v-4M16 21h4v-4"
      />
    </svg>
  );
}

function FsExitIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="map-fs-icon">
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 3v4H5M15 3v4h4M9 21v-4H5M15 21v-4h4"
      />
    </svg>
  );
}

function supportsWebGL(): boolean {
  const canvas = document.createElement("canvas");
  return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
}

function reducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function initialMode(): MapMode {
  return reducedMotion() ? "2d" : "3d";
}

function cellFeatures(
  scene: Scene,
  variable: Variable,
  inset = 0,
): Parameters<maplibregl.GeoJSONSource["setData"]>[0] {
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

const easeInOutCubic = (x: number) => (x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2);

/** Slow rise that overshoots and settles with a damped up/down wobble (0 → 1). */
function raiseCurve(t: number): number {
  if (t < 0.48) return easeInOutCubic(t / 0.48) * 1.28;
  const u = (t - 0.48) / 0.52;
  return t >= 1 ? 1 : 1 + 0.28 * Math.exp(-2.8 * u) * Math.cos(3.5 * Math.PI * u);
}

/** Decaying horizontal shake inside [from, to] of the timeline, 0 elsewhere. */
function shake(t: number, ms: number, from: number, to: number, amp = 1): number {
  if (t < from || t > to) return 0;
  const local = (t - from) / (to - from);
  return (
    SELECTION_SHAKE_PX *
    amp *
    (1 - local) *
    Math.sin((2 * Math.PI * SELECTION_SHAKE_HZ * (t * ms)) / 1000)
  );
}

function studyOffset(): [number, number] {
  return typeof window !== "undefined" && window.innerWidth > 900 ? [140, 10] : [0, 20];
}

function studyCamera(
  map: maplibregl.Map,
  west: number,
  south: number,
  east: number,
  north: number,
): maplibregl.CameraOptions {
  return (
    map.cameraForBounds(
      [
        [west, south],
        [east, north],
      ],
      { padding: 65, ...VIEW_3D, offset: studyOffset() },
    ) ?? {
      center: [(west + east) / 2, (south + north) / 2],
      zoom: 11,
      ...VIEW_3D,
    }
  );
}

function wideCamera(
  west: number,
  south: number,
  east: number,
  north: number,
  studyZoom: number,
): maplibregl.CameraOptions {
  // Slightly south of the window so the cordillera fills the first frame.
  return {
    center: [(west + east) / 2 + 0.03, (south + north) / 2 - 0.14],
    zoom: Math.max(8.1, studyZoom - 2.35),
    pitch: 64,
    bearing: -42,
  };
}

export default function StudyMap({
  scene,
  variable,
  bounds,
  territory = "piloto",
  districts = [],
  overlays = [],
  onOverlayError,
  synthetic = false,
  placeInfo = false,
  selectedCell = null,
  referenceScene = null,
  presentationControls,
  onSelectCell,
  onShellElement,
  onRequestEvidence,
}: {
  scene: Scene;
  referenceScene?: Scene | null;
  presentationControls?: ReactNode;
  variable: Variable;
  bounds: number[];
  territory?: TerritoryId;
  /** Official GAMC polygons drawn as context outlines under the Landsat grid. */
  districts?: OfficialDistrict[];
  /** Allowlisted GAMC service ids to draw as reference images. */
  overlays?: string[];
  onOverlayError?: (serviceId: string) => void;
  synthetic?: boolean;
  /** Query GAMC district and block attributes on click. */
  placeInfo?: boolean;
  selectedCell?: { sceneId: string; index: number } | null;
  onSelectCell?: (next: { sceneId: string; index: number } | null) => void;
  onShellElement?: (element: HTMLDivElement | null) => void;
  onRequestEvidence?: () => void;
}) {
  /** District outlines are context only; the Landsat cell grid + lift stay on. */
  const showDistrictOutlines = territory === "distritos" && districts.length > 0;
  const [difference, setDifference] = useState(false);
  const [opacity, setOpacity] = useState(0.85);
  const differenceActive = difference && referenceScene !== null && !showDistrictOutlines;
  const referenceCells = useMemo(() => new Map(
    referenceScene?.cells.map(cell => [cellKey(cell.bounds), cell]) ?? [],
  ), [referenceScene]);
  const displayScene = useMemo(() => {
    if (!differenceActive) return scene;
    return { ...scene, cells: scene.cells.map(cell => {
      const before = referenceCells.get(cellKey(cell.bounds))?.[variable];
      const after = cell[variable];
      return { ...cell, [variable]: before == null || after == null ? null : after - before };
    }) };
  }, [scene, variable, differenceActive, referenceCells]);
  const displayedValues = useMemo(() => displayScene.cells.map(cell => cell[variable])
    .filter((value): value is number => value != null && Number.isFinite(value)), [displayScene, variable]);
  const scaleLimit = variable === "lst" ? 5 : 0.25;
  const colorScale = useMemo<maplibregl.ExpressionSpecification>(() => differenceActive
    ? ["interpolate", ["linear"], ["get", "value"], -scaleLimit, "#2166ac", 0, "#f7f7f7", scaleLimit, "#b2185b"]
    : FILL[variable], [differenceActive, scaleLimit, variable]);
  const municipalBounds = showDistrictOutlines ? districtBounds(districts) : null;
  // When districts are on, frame the municipality so the 15 polygons are visible.
  const viewBounds = (municipalBounds ?? bounds) as [number, number, number, number];
  const reduceMotion = useReducedMotion();
  const container = useRef<HTMLDivElement>(null);
  const shell = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const overlayErrorRef = useRef(onOverlayError);
  const selectRef = useRef(onSelectCell);
  const [mode, setMode] = useState<MapMode>(initialMode);
  const modeRef = useRef(mode);
  const introDone = useRef(false);
  const introLock = useRef(false);
  const introToken = useRef(0);
  const introTimers = useRef<number[]>([]);
  const introPlayingRef = useRef(false);
  const [intro, setIntro] = useState<IntroState>("done");
  const [titlePhase, setTitlePhase] = useState<TitlePhase>("off");
  const [selectedDistrictName, setSelectedDistrictName] = useState<string | null>(null);
  const [districtSeries, setDistrictSeries] = useState<
    DistrictSeriesResult | { status: "loading" } | null
  >(null);
  const [districtWeather, setDistrictWeather] = useState<WeatherReading | null>(null);
  const [districtWeatherLoading, setDistrictWeatherLoading] = useState(false);
  const districtSeriesGen = useRef(0);
  const districtLiftFrame = useRef(0);
  const districtLiftHeight = useRef(0);
  const liftedDistrictIndex = useRef(-1);
  const districtSelectRef = useRef<(index: number) => void>(() => {});

  const [loaded, setLoaded] = useState(false);

  const { theme } = useTheme();
  const lightCurrent = useRef<MapLight>(theme === "day" ? LIGHT_DAY : LIGHT_NIGHT);
  const lightFrame = useRef(0);
  const lightDelay = useRef<number | null>(null);
  const [lightBusy, setLightBusy] = useState(false);
  useEffect(() => {
    const map = mapRef.current;
    if (!loaded || !map) return;
    const wantDay = theme === "day" || mode === "2d";
    const target = wantDay ? LIGHT_DAY : LIGHT_NIGHT;
    const from = { ...lightCurrent.current };
    const shellEl = shell.current;

    const finish = (light: MapLight) => {
      lightCurrent.current = light;
      paintMapLight(map, light);
      setLightBusy(false);
      if (shellEl) shellEl.dataset.lightShift = "";
    };

    if (lightDelay.current != null) window.clearTimeout(lightDelay.current);
    cancelAnimationFrame(lightFrame.current);

    if (reducedMotion() || mode === "2d") {
      finish(target);
      return;
    }

    const same =
      Math.abs(from.brightness - target.brightness) < 0.01 &&
      from.sky === target.sky;
    if (same) {
      finish(target);
      return;
    }

    setLightBusy(true);
    if (shellEl) shellEl.dataset.lightShift = wantDay ? "to-day" : "to-night";

    lightDelay.current = window.setTimeout(() => {
      lightDelay.current = null;
      const start = performance.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / LIGHT_BLEND_MS);
        const light = mixLight(from, target, easeInOutCubic(t));
        lightCurrent.current = light;
        paintMapLight(map, light);
        if (t < 1) lightFrame.current = requestAnimationFrame(tick);
        else finish(target);
      };
      lightFrame.current = requestAnimationFrame(tick);
    }, LIGHT_DELAY_MS);

    return () => {
      if (lightDelay.current != null) window.clearTimeout(lightDelay.current);
      lightDelay.current = null;
      cancelAnimationFrame(lightFrame.current);
      setLightBusy(false);
      if (shellEl && shellEl.dataset.lightShift) shellEl.dataset.lightShift = "";
    };
  }, [theme, loaded, mode]);
  const [baseError, setBaseError] = useState(false);
  const [contextLost, setContextLost] = useState(false);
  const [basemap, setBasemap] = useState<Basemap>("streets");
  useEffect(() => {
    const map = mapRef.current;
    if (!loaded || !map) return;
    setBaseError(false);
    if (map.getLayer("base-streets")) {
      map.setLayoutProperty(
        "base-streets",
        "visibility",
        basemap === "streets" ? "visible" : "none",
      );
    }
    if (map.getLayer("base-satellite")) {
      map.setLayoutProperty(
        "base-satellite",
        "visibility",
        basemap === "satellite" ? "visible" : "none",
      );
    }
    if (map.getLayer("hillshade")) {
      map.setLayoutProperty("hillshade", "visibility", mode === "3d" ? "visible" : "none");
      map.setPaintProperty(
        "hillshade",
        "hillshade-exaggeration",
        basemap === "satellite" ? 0.25 : 0.55,
      );
    }
  }, [basemap, loaded, mode]);
  const [initError, setInitError] = useState(false);
  const [orbiting, setOrbiting] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [fullscreenError, setFullscreenError] = useState(false);
  const [fsCinema, setFsCinema] = useState<FsCinema>("idle");
  const fsTimers = useRef<number[]>([]);
  const fsToken = useRef(0);
  const fsPlayingRef = useRef(false);
  const wasFullscreen = useRef(false);
  const [internalPick, setInternalPick] = useState<{
    sceneId: string;
    index: number;
  } | null>(null);
  const controlled = onSelectCell != null;
  const picked = controlled ? selectedCell : internalPick;
  const [place, setPlace] = useState<Place | null>(null);
  const [outsideCoverage, setOutsideCoverage] = useState(false);
  const placeRequest = useRef<AbortController | null>(null);
  const sceneRef = useRef(scene.id);
  const cellsRef = useRef(scene.cells);
  const liftHeight = useRef(0);
  const liftedIndex = useRef(-1);
  const introPlaying = intro === "playing";
  const fsActive =
    fsCinema === "playing" ||
    fsCinema === "title" ||
    fsCinema === "hold" ||
    fsCinema === "fade";
  // Rendered only in the browser (dynamic import with ssr: false).
  const [unsupported] = useState(() => !supportsWebGL());
  const [west, south, east, north] = viewBounds;
  const overlayKey = overlays.join(",");
  const publishPick = (next: { sceneId: string; index: number } | null) => {
    if (!controlled) setInternalPick(next);
    selectRef.current?.(next);
  };
  const animateDistrictHeight = (target: number, done?: () => void) => {
    const map = mapRef.current;
    if (!map?.getLayer("district-selected")) return;
    cancelAnimationFrame(districtLiftFrame.current);
    const from = districtLiftHeight.current;
    const started = performance.now();
    const rising = target > from;
    const duration = reducedMotion() ? 1100 : SELECTION_RAISE_MS;
    const shakeAmp = reducedMotion() ? 0.55 : 1;
    const setShake = (dx: number) => {
      map.setPaintProperty("district-selected", "fill-extrusion-translate", [dx, 0]);
    };
    map.setPaintProperty("district-selected", "fill-extrusion-height-transition", { duration: 0 });
    map.setPaintProperty("district-selected", "fill-extrusion-translate-transition", { duration: 0 });
    map.setPaintProperty("district-selected", "fill-extrusion-translate-anchor", "viewport");
    if (Math.abs(target - from) < 1) {
      districtLiftHeight.current = target;
      map.setPaintProperty("district-selected", "fill-extrusion-height", target);
      setShake(0);
      done?.();
      return;
    }
    // Preserve district selection feedback: lift, bounce and shake on both paths.
    const tick = (now: number) => {
      if (mapRef.current !== map) return;
      const t = Math.min(1, (now - started) / duration);
      const progress = rising ? raiseCurve(t) : 1 - raiseCurve(1 - t);
      districtLiftHeight.current = Math.max(0, from + (target - from) * progress);
      map.setPaintProperty("district-selected", "fill-extrusion-height", districtLiftHeight.current);
      setShake(rising
        ? shake(t, duration, 0, 0.38, shakeAmp) + shake(t, duration, 0.48, 0.92, 0.55 * shakeAmp)
        : shake(t, duration, 0.1, 0.28, 0.45 * shakeAmp) + shake(t, duration, 0.4, 1, shakeAmp));
      if (shell.current) shell.current.dataset.districtHeight = districtLiftHeight.current.toFixed(1);
      if (t < 1) districtLiftFrame.current = requestAnimationFrame(tick);
      else {
        setShake(0);
        done?.();
      }
    };
    districtLiftFrame.current = requestAnimationFrame(tick);
  };
  const closeDistrict = () => {
    setSelectedDistrictName(null);
    setDistrictSeries(null);
    districtSeriesGen.current += 1;
    animateDistrictHeight(0, () => {
      liftedDistrictIndex.current = -1;
      mapRef.current?.setFilter("district-selected", ["==", ["get", "index"], -1]);
    });
  };
  const selectDistrict = (index: number) => {
    const district = districts[index];
    const map = mapRef.current;
    if (!district || !map?.getLayer("district-selected")) return;
    setOrbiting(false);
    publishPick(null);
    setPlace(null);
    setSelectedDistrictName(district.name);
    setDistrictSeries({ status: "loading" });
    const collection = districtFeatureCollection(districts);
    const feature = collection.features.find(
      (row) => row.properties.number === district.number,
    );
    if (!feature) return;
    const threeD = modeRef.current === "3d" && !reducedMotion();
    const raise = () => {
      if (mapRef.current !== map) return;
      (map.getSource("districts") as maplibregl.GeoJSONSource).setData(collection);
      liftedDistrictIndex.current = feature.properties.index;
      map.setFilter("district-selected", ["==", ["get", "index"], feature.properties.index]);
      map.moveLayer("district-selected");
      const box = districtBounds([district]);
      if (box) {
        map.fitBounds(
          [
            [box[0], box[1]],
            [box[2], box[3]],
          ],
          {
            padding: 65,
            pitch: threeD ? 55 : 0,
            bearing: threeD ? map.getBearing() : 0,
            duration: reducedMotion() ? 0 : threeD ? 900 : 450,
          },
        );
      }
      if (threeD) animateDistrictHeight(800);
      else {
        districtLiftHeight.current = 0;
        if (map.getLayer("district-selected")) {
          map.setPaintProperty("district-selected", "fill-extrusion-height", 0);
        }
      }
    };
    if (
      threeD &&
      liftedDistrictIndex.current !== feature.properties.index &&
      districtLiftHeight.current > 0
    ) {
      animateDistrictHeight(0, raise);
    } else raise();
  };
  useEffect(() => { districtSelectRef.current = selectDistrict; });
  useEffect(() => () => cancelAnimationFrame(districtLiftFrame.current), []);

  const selectedDistrict = selectedDistrictName
    ? districts.find((district) => district.name === selectedDistrictName) ?? null
    : null;
  const selectedCentroid = selectedDistrict
    ? districtCentroid(selectedDistrict)
    : null;

  useEffect(() => {
    if (!selectedDistrict) return;
    const requestId = ++districtSeriesGen.current;
    let cancelled = false;
    loadDistrictIndicators({
      districtNumber: selectedDistrict.number,
      boundaryVersion: selectedDistrict.boundary_version,
    })
      .then((result) => {
        if (!cancelled && districtSeriesGen.current === requestId) {
          setDistrictSeries(result);
        }
      })
      .catch(() => {
        if (!cancelled && districtSeriesGen.current === requestId) {
          setDistrictSeries({
            status: "error",
            reason: "No se pudo cargar la serie oficial del distrito.",
            items: [],
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [selectedDistrict]);


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
    publishPick(null);
    setPlace(null);
  };

  useEffect(() => {
    overlayErrorRef.current = onOverlayError;
    selectRef.current = onSelectCell;
    modeRef.current = mode;
    sceneRef.current = scene.id;
    cellsRef.current = scene.cells;
    lookupRef.current = lookup;
    introPlayingRef.current = introPlaying;
    fsPlayingRef.current = fsActive;
  });

  useEffect(() => {
    onShellElement?.(shell.current);
    return () => onShellElement?.(null);
  }, [onShellElement]);

  useEffect(() => () => placeRequest.current?.abort(), []);

  useEffect(() => {
    if (!container.current || unsupported) return;
    maplibregl.setWorkerUrl("/maplibre-worker.mjs");
    let map: maplibregl.Map;
    // District mode skips the distant cinema start so official polygons are readable.
    const openWide =
      !showDistrictOutlines && !reducedMotion() && modeRef.current === "3d";
    try {
      map = new maplibregl.Map({
        container: container.current,
        ...(openWide
          ? {
              center: [(west + east) / 2 + 0.03, (south + north) / 2 - 0.14] as [number, number],
              zoom: 8.4,
              pitch: 64,
              bearing: -42,
            }
          : {
              bounds: [
                [west, south],
                [east, north],
              ] as [[number, number], [number, number]],
              fitBoundsOptions: {
                padding: 60,
                ...(modeRef.current === "3d" ? VIEW_3D : { pitch: 0, bearing: 0 }),
              },
            }),
        style: {
          version: 8,
          glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
          sources: {
            osm: {
              type: "raster",
              tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
              tileSize: 256,
              attribution: "© OpenStreetMap contributors",
            },
            satellite: {
              type: "raster",
              tiles: [SATELLITE_TILES],
              tileSize: 256,
              attribution: SATELLITE_ATTRIBUTION,
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
              id: "base-streets",
              type: "raster",
              source: "osm",
              paint: { "raster-saturation": -0.85, "raster-brightness-max": 0.62 },
            },
            {
              id: "base-satellite",
              type: "raster",
              source: "satellite",
              layout: { visibility: "none" },
              paint: { "raster-saturation": 0, "raster-brightness-max": 1 },
            },
            {
              id: "hillshade",
              type: "hillshade",
              layout: { visibility: "none" },
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
        locale: { "NavigationControl.ZoomIn": "Acercar", "NavigationControl.ZoomOut": "Alejar", "NavigationControl.ResetBearing": "Orientar al norte", "AttributionControl.ToggleAttribution": "Mostrar fuentes" },
        doubleClickZoom: false,
        maxZoom: 16,
        maxPitch: 78,
      });
    } catch {
      queueMicrotask(() => setInitError(true));
      return;
    }
    map.on("webglcontextlost", () => { setContextLost(true); setOrbiting(false); });
    map.on("webglcontextrestored", () => setContextLost(false));
    map.on("movestart", (event) => { if (event.originalEvent) setOrbiting(false); });

    map.getCanvas().setAttribute("aria-label", "Mapa de observaciones");
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
    map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-right");
    map.on("error", (event: maplibregl.ErrorEvent & { sourceId?: string }) => {
      const source = event.sourceId ?? "";
      if (source.startsWith(OVERLAY_PREFIX))
        overlayErrorRef.current?.(source.slice(OVERLAY_PREFIX.length));
      else setBaseError(true);
    });
    map.on("load", () => {
      map.addSource("districts", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addSource("evidence", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addSource("evidence-3d", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer({ id: "district-selected", type: "fill-extrusion", source: "districts",
        filter: ["==", ["get", "index"], -1],
        paint: { "fill-extrusion-color": "#82b4cc", "fill-extrusion-opacity": 0.65,
          "fill-extrusion-height": 0, "fill-extrusion-height-transition": { duration: 1400 } } });
      map.on("click", "district-fill", (event) => {
        if (fsPlayingRef.current) return;
        const index = event.features?.[0]?.properties?.index;
        if (index != null) districtSelectRef.current(Number(index));
      });
      // Soft district fill under the Landsat grid so click-to-lift keeps priority.
      map.addLayer({
        id: "district-fill",
        type: "fill",
        source: "districts",
        layout: { visibility: "none" },
        paint: {
          "fill-color": "#2a7f9e",
          "fill-opacity": 0.28,
        },
      });
      // Surface default: invisible hit fill + borders only. No coloured pads until selection.
      map.addLayer({
        id: "cells",
        type: "fill",
        source: "evidence",
        // Tiny opacity keeps the layer queryable for click-to-lift.
        paint: { "fill-color": FILL.lst, "fill-opacity": 0.65 },
      });
      map.addLayer({
        id: "cell-borders",
        type: "line",
        source: "evidence",
        paint: {
          "line-color": "#e8f4fa",
          "line-width": 0.7,
          "line-opacity": 0.5,
        },
      });
      // Official outlines above the cell grid so the 15 districts stay readable.
      map.addLayer({
        id: "district-outline",
        type: "line",
        source: "districts",
        layout: { visibility: "none" },
        paint: {
          "line-color": "#ffd978",
          "line-width": 3.2,
          "line-opacity": 1,
        },
      });
      map.addLayer({
        id: "district-labels",
        type: "symbol",
        source: "districts",
        layout: {
          visibility: "none",
          "text-field": ["to-string", ["get", "number"]],
          "text-size": 14,
          "text-font": ["Open Sans Regular", "Arial Unicode MS Regular"],
          "text-allow-overlap": true,
          "text-ignore-placement": true,
        },
        paint: {
          "text-color": "#fff4c8",
          "text-halo-color": "#0b1419",
          "text-halo-width": 1.4,
        },
      });
      map.addLayer({
        id: "district-selection",
        type: "line",
        source: "districts",
        layout: { visibility: "none" },
        filter: ["==", ["get", "index"], -1],
        paint: {
          "line-color": "#fff7d6",
          "line-width": 3.5,
          "line-opacity": 1,
        },
      });
      map.addLayer({ id: "cell-selection", type: "line", source: "evidence",
        filter: ["==", ["to-number", ["get", "index"]], -1],
        paint: {
          "line-color": "#f4f7fa",
          "line-width": 3.5,
          "line-opacity": 1,
          "line-gap-width": 1.5,
        } });
      map.addLayer({ id: "selected-lift", type: "fill-extrusion", source: "evidence-3d",
        filter: ["==", ["to-number", ["get", "index"]], -1],
        paint: {
          "fill-extrusion-color": "#eaf8ff",
          "fill-extrusion-opacity": 0.92,
          "fill-extrusion-height": 0,
          "fill-extrusion-base": 0,
          "fill-extrusion-vertical-gradient": true,
          "fill-extrusion-height-transition": { duration: 0, delay: 0 },
        } });
      let lastSelectionEvent: Event | undefined;
      let lastSelectionTime = -Infinity;
      const popup = (event: maplibregl.MapLayerMouseEvent) => {
        if (showDistrictOutlines || introPlayingRef.current || fsPlayingRef.current) return;
        if (lastSelectionEvent === event.originalEvent) return;
        lastSelectionEvent = event.originalEvent;
        const now = performance.now();
        if (now - lastSelectionTime < 400) return;
        lastSelectionTime = now;
        map.stop();
        const raw = event.features?.[0]?.properties?.index;
        const index = typeof raw === "number" ? raw : Number(raw);
        if (!Number.isFinite(index)) return;
        setOrbiting(false);
        // Cell lift is a 3D extrusion — switch out of flat 2D when picking.
        // Preserve the chosen view; selection also works in 2D.
        const next = { sceneId: sceneRef.current, index };
        if (selectRef.current) selectRef.current(next);
        else
          setInternalPick((prev) =>
            prev?.sceneId === next.sceneId && prev.index === next.index ? null : next,
          );
        lookupRef.current(event.lngLat.lng, event.lngLat.lat);
      };
      map.on("click", "cells", popup);
      map.on("click", "selected-lift", popup);
      map.on("click", (event) => {
        if (showDistrictOutlines) return;
        if (introPlayingRef.current || fsPlayingRef.current) return;
        // Invisible hit fill on "cells"; selected-lift stays clickable while raised.
        const hit = map.queryRenderedFeatures(event.point, {
          layers: ["cells", "selected-lift"],
        })[0];
        if (hit) return;
        // Terrain can occlude the almost-transparent hit layer. Resolve the
        // actual published cell at the ground coordinate as a fallback.
        const index = cellsRef.current.findIndex((cell) => {
          const [w, s, e, n] = cell.bounds;
          return event.lngLat.lng >= w && event.lngLat.lng <= e &&
            event.lngLat.lat >= s && event.lngLat.lat <= n;
        });
        if (index >= 0) {
          setOrbiting(false);
          // Preserve the chosen view; selection also works in 2D.
          const next = { sceneId: sceneRef.current, index };
          if (selectRef.current) selectRef.current(next);
          else setInternalPick(next);
          lookupRef.current(event.lngLat.lng, event.lngLat.lat);
          return;
        }
        if (!selectRef.current) setInternalPick(null);
        selectRef.current?.(null);
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
      for (const layer of ["cells", "selected-lift"]) {
        map.on("mouseenter", layer, () => (map.getCanvas().style.cursor = "pointer"));
        map.on("mouseleave", layer, () => (map.getCanvas().style.cursor = ""));
      }
      // Keep hit-test / lift layers above district strokes so clicks stay reliable.
      if (map.getLayer("cells")) map.moveLayer("cells");
      if (map.getLayer("cell-borders")) map.moveLayer("cell-borders");
      if (map.getLayer("cell-selection")) map.moveLayer("cell-selection");
      if (map.getLayer("selected-lift")) map.moveLayer("selected-lift");
      const initialLight =
        document.documentElement.dataset.mapLight === "day" ? LIGHT_DAY : LIGHT_NIGHT;
      lightCurrent.current = initialLight;
      paintMapLight(map, initialLight);
      mapRef.current = map;
      setLoaded(true);
    });
    return () => {
      for (const id of introTimers.current) window.clearTimeout(id);
      introTimers.current = [];
      introToken.current += 1;
      mapRef.current = null;
      introDone.current = false;
      setIntro("done");
      setTitlePhase("off");
      setLoaded(false);
      map.remove();
    };
  }, [west, south, east, north, unsupported, showDistrictOutlines]);

  // Official districts are irregular GAMC polygons — never the Landsat cell mesh.
  useEffect(() => {
    const map = mapRef.current;
    if (!loaded || !map || !map.getSource("districts")) return;
    const collection = districtFeatureCollection(districts);
    (map.getSource("districts") as maplibregl.GeoJSONSource).setData(collection);
    for (const layer of [
      "district-fill",
      "district-outline",
      "district-labels",
      "district-selection",
    ]) {
      if (map.getLayer(layer)) {
        map.setLayoutProperty(
          layer,
          "visibility",
          showDistrictOutlines ? "visible" : "none",
        );
      }
    }
    // Keep an invisible hit fill for click-to-lift, but hide the white cell
    // wireframe so it is not mistaken for municipal districts.
    if (map.getLayer("cells")) {
      map.setLayoutProperty("cells", "visibility", "visible");
    }
    if (map.getLayer("cell-borders")) {
      map.setLayoutProperty(
        "cell-borders",
        "visibility",
        showDistrictOutlines ? "none" : "visible",
      );
    }
    for (const layer of ["cell-selection", "selected-lift"]) {
      if (map.getLayer(layer)) {
        map.setLayoutProperty(layer, "visibility", "visible");
      }
    }
  }, [loaded, showDistrictOutlines, districts]);

  // Outline grid only; selection lift paints the active cell.
  useEffect(() => {
    const map = mapRef.current;
    if (!loaded || !map) return;
    (map.getSource("evidence") as maplibregl.GeoJSONSource).setData(
      cellFeatures(displayScene, variable),
    );
    (map.getSource("evidence-3d") as maplibregl.GeoJSONSource).setData(
      cellFeatures(displayScene, variable, 0.06),
    );
    map.setPaintProperty("cells", "fill-color", colorScale);
    map.setPaintProperty("selected-lift", "fill-extrusion-color", colorScale);
  }, [loaded, displayScene, variable, colorScale]);

  useEffect(() => {
    if (!loaded || !mapRef.current) return;
    mapRef.current.setPaintProperty("cells", "fill-opacity", showDistrictOutlines ? 0.01 : opacity);
  }, [loaded, showDistrictOutlines, opacity]);

  const clearIntroTimers = () => {
    for (const id of introTimers.current) window.clearTimeout(id);
    introTimers.current = [];
  };

  const settleStudy = (map: maplibregl.Map, animate: boolean) => {
    const camera = studyCamera(map, west, south, east, north);
    map.stop();
    if (animate && !reducedMotion()) map.easeTo({ ...camera, duration: 700, essential: false });
    else map.jumpTo(camera);
  };

  const endIntro = (map: maplibregl.Map, animate: boolean) => {
    clearIntroTimers();
    introToken.current += 1;
    introLock.current = false;
    setTitlePhase("off");
    settleStudy(map, animate);
    introDone.current = true;
    setIntro("done");
  };

  const playIntro = (map: maplibregl.Map) => {
    clearIntroTimers();
    const token = ++introToken.current;
    introLock.current = true;
    setOrbiting(false);
    publishPick(null);
    setIntro("playing");
    setTitlePhase("off");
    introDone.current = false;
    map.setTerrain({ source: "dem", exaggeration: TERRAIN_EXAGGERATION });
    const study = studyCamera(map, west, south, east, north);
    const wide = wideCamera(west, south, east, north, study.zoom ?? map.getZoom());
    map.stop();
    map.jumpTo(wide);

    const finish = () => {
      if (introToken.current !== token) return;
      introLock.current = false;
      introDone.current = true;
      setTitlePhase("off");
      setIntro("done");
    };

    if (reducedMotion()) {
      settleStudy(map, false);
      setTitlePhase("in");
      const brief = window.setTimeout(finish, 900);
      introTimers.current.push(brief);
      return;
    }

    const after = (ms: number, fn: () => void) => {
      const id = window.setTimeout(() => {
        if (introToken.current !== token || mapRef.current !== map) return;
        fn();
      }, ms);
      introTimers.current.push(id);
    };

    const titleInAt = INTRO_HOLD_MS + INTRO_TITLE_AT_MS;
    const titleOutAt = titleInAt + INTRO_TITLE_HOLD_MS;

    after(INTRO_HOLD_MS, () => {
      map.flyTo({
        ...study,
        duration: INTRO_FLIGHT_MS,
        curve: 1.02,
        easing: easeInOutCubic,
        essential: false,
      });
    });
    after(titleInAt, () => setTitlePhase("in"));
    after(titleOutAt, () => setTitlePhase("out"));
    after(titleOutAt + INTRO_TITLE_FADE_MS, () => setTitlePhase("off"));
    after(INTRO_HOLD_MS + INTRO_FLIGHT_MS + 280, finish);
  };

  // Relief, camera and cinematic entrance.
  useEffect(() => {
    const map = mapRef.current;
    if (!loaded || !map) return;
    const three = mode === "3d";
    map.setTerrain(three ? { source: "dem", exaggeration: TERRAIN_EXAGGERATION } : null);
    // Invisible hit fill + borders. With official districts on, hide the Landsat wireframe.
    map.setLayoutProperty("cells", "visibility", "visible");
    map.setLayoutProperty(
      "cell-borders",
      "visibility",
      showDistrictOutlines ? "none" : "visible",
    );
    if (map.getLayer("cell-selection")) {
      map.setLayoutProperty("cell-selection", "visibility", "visible");
    }
    if (map.getLayer("selected-lift")) {
      map.setLayoutProperty("selected-lift", "visibility", "visible");
    }
    if (!three) {
      if (!introDone.current || introLock.current) {
        clearIntroTimers();
        introToken.current += 1;
        introLock.current = false;
        setTitlePhase("off");
        introDone.current = true;
        setIntro("done");
      }
      const flat = { pitch: 0, bearing: 0 };
      if (reducedMotion()) map.jumpTo(flat);
      else map.easeTo({ ...flat, duration: 1200 });
      return;
    }
    if (!introDone.current) { playIntro(map); return; }
    // Normal view settles without an automatic cinematic sequence.
    if (reducedMotion()) map.jumpTo(VIEW_3D);
    else map.easeTo({ ...VIEW_3D, duration: 1200 });
  // Camera lifecycle intentionally reacts to view changes, not callback identity.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, mode, west, south, east, north, showDistrictOutlines]);

  // Skip with Escape or map interaction while the entrance is playing.
  useEffect(() => {
    if (!introPlaying) return;
    const map = mapRef.current;
    if (!map) return;
    const skip = () => endIntro(map, true);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") skip();
    };
    const canvas = map.getCanvas();
    canvas.addEventListener("pointerdown", skip);
    canvas.addEventListener("wheel", skip, { passive: true });
    window.addEventListener("keydown", onKey);
    return () => {
      canvas.removeEventListener("pointerdown", skip);
      canvas.removeEventListener("wheel", skip);
      window.removeEventListener("keydown", onKey);
    };
    // endIntro closes over current bounds; rebind when they change mid-flight.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [introPlaying, west, south, east, north]);

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
      if (document.hidden || !shell.current || shell.current.getBoundingClientRect().bottom < 0 || shell.current.getBoundingClientRect().top > window.innerHeight) {
        stop();
        return;
      }
      map.jumpTo({ bearing: map.getBearing() + Math.min(now - previous, 50) * 0.003 });
      previous = now;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    const canvas = map.getCanvas();
    map.getContainer().addEventListener("pointerdown", stop, true);
    canvas.addEventListener("wheel", stop);
    canvas.addEventListener("keydown", stop);
    document.addEventListener("visibilitychange", visibility);
    motion.addEventListener("change", stop);
    return () => {
      cancelAnimationFrame(frame);
      map.getContainer().removeEventListener("pointerdown", stop, true);
      canvas.removeEventListener("wheel", stop);
      canvas.removeEventListener("keydown", stop);
      document.removeEventListener("visibilitychange", visibility);
      motion.removeEventListener("change", stop);
    };
  }, [loaded, orbiting, mode]);

  const clearFsTimers = () => {
    for (const id of fsTimers.current) window.clearTimeout(id);
    fsTimers.current = [];
  };

  /** Abort cinema immediately. Used on skip and on fullscreen exit — never animate out. */
  const endFsCinema = (restoreCamera = false) => {
    clearFsTimers();
    fsToken.current += 1;
    if (restoreCamera && mapRef.current) {
      mapRef.current.stop();
    }
  };

  // Retained as an optional cinematic sequence; presentations open immediately.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const playFsCinema = (map: maplibregl.Map) => {
    clearFsTimers();
    const token = ++fsToken.current;
    setOrbiting(false);
    map.resize();
    if (reducedMotion()) {
      setFsCinema("done");
      return;
    }
    setFsCinema("playing");
    const after = (ms: number, fn: () => void) => {
      const id = window.setTimeout(() => {
        if (fsToken.current !== token || mapRef.current !== map) return;
        fn();
      }, ms);
      fsTimers.current.push(id);
    };

    const titleInAt = FS_RESIZE_MS + 120;
    const holdAt = titleInAt + FS_TITLE_IN_MS;
    const fadeAt = holdAt + FS_TITLE_HOLD_MS;
    const controlsAt = fadeAt + FS_TITLE_FADE_MS;
    const doneAt = controlsAt + FS_CONTROLS_MS;

    after(FS_RESIZE_MS, () => {
      if (
        !Number.isFinite(west) ||
        !Number.isFinite(south) ||
        !Number.isFinite(east) ||
        !Number.isFinite(north) ||
        east <= west ||
        north <= south
      ) {
        return;
      }
      const study = studyCamera(map, west, south, east, north);
      const wide = wideCamera(west, south, east, north, study.zoom ?? map.getZoom());
      map.stop();
      map.jumpTo(wide);
      map.easeTo({
        ...study,
        duration: FS_ZOOM_MS,
        easing: easeInOutCubic,
        essential: false,
      });
    });
    after(titleInAt, () => setFsCinema("title"));
    after(holdAt, () => setFsCinema("hold"));
    after(fadeAt, () => setFsCinema("fade"));
    after(controlsAt, () => setFsCinema("controls"));
    after(doneAt, () => setFsCinema("done"));
  };

  useEffect(() => {
    const changed = () => {
      const active = document.fullscreenElement === shell.current;
      const entering = active && !wasFullscreen.current;
      const leaving = !active && wasFullscreen.current;
      wasFullscreen.current = active;
      setFullscreen(active);
      mapRef.current?.resize();
      // Cinema only when entering fullscreen — never on exit.
      if (entering && mapRef.current) {
        setOrbiting(false);
        setFsCinema("done");
        requestAnimationFrame(() => {
          const map = mapRef.current;
          if (!map || document.fullscreenElement !== shell.current) return;
          map.resize();
          map.fitBounds([[west, south], [east, north]], {
            padding: window.innerWidth > 800 ? { top: 50, bottom: 50, left: 260, right: 80 } : 55,
            duration: 0,
            pitch: modeRef.current === "3d" ? VIEW_3D.pitch : 0,
          });
        });
      } else if (leaving) {
        endFsCinema(true);
        setFsCinema("idle");
      }
    };
    document.addEventListener("fullscreenchange", changed);
    const observer = new ResizeObserver(() => mapRef.current?.resize());
    if (shell.current) observer.observe(shell.current);
    if (container.current) observer.observe(container.current);
    return () => {
      document.removeEventListener("fullscreenchange", changed);
      observer.disconnect();
      clearFsTimers();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [west, south, east, north]);

  useEffect(() => {
    if (!fsActive) return;
    const map = mapRef.current;
    if (!map) return;
    const skip = () => {
      endFsCinema();
      setFsCinema("done");
    };
    const canvas = map.getCanvas();
    canvas.addEventListener("pointerdown", skip);
    canvas.addEventListener("wheel", skip, { passive: true });
    return () => {
      canvas.removeEventListener("pointerdown", skip);
      canvas.removeEventListener("wheel", skip);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fsActive]);

  const resetCamera = () => {
    setOrbiting(false);
    if (introPlaying && mapRef.current) {
      endIntro(mapRef.current, true);
      return;
    }
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
      if (document.fullscreenElement === shell.current) {
        // Exit: no cinema. fullscreenchange clears state to idle.
        await document.exitFullscreen();
      } else {
        // Sequence starts only after fullscreenchange confirms entry.
        await shell.current?.requestFullscreen();
      }
    } catch {
      setFullscreenError(true);
      setFsCinema("idle");
    }
  };
  const inspected =
    picked?.sceneId === scene.id ? scene.cells[picked.index] ?? null : null;

  useEffect(() => {
    const map = mapRef.current;
    if (!loaded || !map?.getLayer("district-selection")) return;
    // Outlines only — selection stays on Landsat cells.
    map.setFilter("district-selection", ["==", ["get", "index"], -1]);
  }, [loaded, showDistrictOutlines]);

  const pickedSceneId = picked?.sceneId ?? null;
  const pickedIndex = picked?.index ?? -1;

  useEffect(() => {
    const map = mapRef.current;
    if (!loaded || !map?.getLayer("cell-selection")) return;
    const selected =
      pickedSceneId === scene.id && pickedIndex >= 0
        ? scene.cells[pickedIndex] ?? null
        : null;
    const index = selected ? pickedIndex : -1;
    let frame = 0;
    const switching =
      selected &&
      liftedIndex.current !== -1 &&
      liftedIndex.current !== index &&
      liftHeight.current > 0;
    const instant = { duration: 0, delay: 0 };
    // Lift stays available whenever a Landsat cell is selected.
    map.setLayoutProperty("selected-lift", "visibility", "visible");
    map.setLayoutProperty("cell-selection", "visibility", "visible");
    map.setPaintProperty("selected-lift", "fill-extrusion-height-transition", instant);
    map.setPaintProperty("selected-lift", "fill-extrusion-translate-transition", instant);
    map.setPaintProperty("selected-lift", "fill-extrusion-translate-anchor", "viewport");
    map.setPaintProperty("cell-selection", "line-translate-transition", instant);
    map.setPaintProperty("cell-selection", "line-translate-anchor", "viewport");
    const indexEq = (next: number): maplibregl.FilterSpecification => [
      "==",
      ["to-number", ["get", "index"]],
      next,
    ];
    const indexNeq = (next: number): maplibregl.FilterSpecification => [
      "!=",
      ["to-number", ["get", "index"]],
      next,
    ];
    const showIndex = (next: number) => {
      liftedIndex.current = next;
      map.setFilter("cell-selection", indexEq(next));
      map.setFilter("selected-lift", indexEq(next));
      // Hide the base hit fill so the rising extrusion is the only surface.
      const rest = next < 0 ? null : indexNeq(next);
      map.setFilter("cells", rest);
      map.setFilter("cell-borders", rest);
    };
    const setShake = (dx: number) => {
      map.setPaintProperty("selected-lift", "fill-extrusion-translate", [dx, 0]);
      map.setPaintProperty("cell-selection", "line-translate", [dx, 0]);
    };
    const ensureView = () => {
      // Extrusions need pitch; frame the selected cell so the lift is readable.
      if (modeRef.current !== "3d") setMode("3d");
      const [cw, cs, ce, cn] = selected?.bounds ?? [west, south, east, north];
      const camera = {
        center: [(cw + ce) / 2, (cs + cn) / 2] as [number, number],
        zoom: Math.max(map.getZoom(), 13),
        pitch: VIEW_3D.pitch,
        bearing: map.getBearing() || VIEW_3D.bearing,
      };
      if (reducedMotion()) map.jumpTo(camera);
      else map.easeTo({ ...camera, duration: 700, essential: true });
    };
    const animateHeight = (target: number, done?: () => void) => {
      const from = liftHeight.current;
      const rising = target > from;
      // Selection lift is interaction feedback: keep bounce/shake. Reduced motion only shortens it.
      const calm = reducedMotion();
      const start = performance.now();
      // Same timing both ways so deselect plays the raise curve in reverse.
      const duration = calm ? 1100 : SELECTION_RAISE_MS;
      const shakeAmp = calm ? 0.55 : 1;
      // Already parked at the target: skip a no-op that would only shake sideways.
      if (Math.abs(target - from) < 1) {
        liftHeight.current = target;
        map.setPaintProperty("selected-lift", "fill-extrusion-height", target);
        setShake(0);
        done?.();
        return;
      }
      const tick = (now: number) => {
        if (mapRef.current !== map) return;
        const t = Math.min(1, (now - start) / duration);
        const progress = rising ? raiseCurve(t) : 1 - raiseCurve(1 - t);
        liftHeight.current = Math.max(0, from + (target - from) * progress);
        map.setPaintProperty("selected-lift", "fill-extrusion-height", liftHeight.current);
        // Rise: shake on takeoff + light wobble while settling. Drop: shake on impact.
        setShake(
          rising
            ? shake(t, duration, 0, 0.38, shakeAmp) +
                shake(t, duration, 0.48, 0.92, 0.55 * shakeAmp)
            : shake(t, duration, 0.1, 0.28, 0.45 * shakeAmp) +
                shake(t, duration, 0.4, 1, shakeAmp),
        );
        if (t < 1) frame = requestAnimationFrame(tick);
        else {
          setShake(0);
          done?.();
        }
      };
      frame = requestAnimationFrame(tick);
    };
    // Unselected cells are flat outlines; the lift always starts and ends on the ground.
    const ground = 0;
    if (switching) {
      ensureView();
      animateHeight(ground, () => {
        liftHeight.current = ground;
        map.setPaintProperty("selected-lift", "fill-extrusion-height", ground);
        showIndex(index);
        animateHeight(SELECTION_LIFT_M);
      });
    } else if (selected) {
      ensureView();
      if (liftedIndex.current !== index) {
        liftHeight.current = ground;
        map.setPaintProperty("selected-lift", "fill-extrusion-height", ground);
      }
      showIndex(index);
      animateHeight(SELECTION_LIFT_M);
    } else {
      animateHeight(ground, () => {
        showIndex(-1);
        liftHeight.current = 0;
        if (mapRef.current === map) {
          map.setPaintProperty("selected-lift", "fill-extrusion-height", 0);
        }
      });
    }
    const stop = () => {
      cancelAnimationFrame(frame);
      if (mapRef.current === map) setShake(0);
    };
    if (!selected || index < 0) return stop;
    const [w, s, e, n] = selected.bounds;
    const markerElement = document.createElement("span");
    markerElement.className = "selected-cell-label";
    markerElement.textContent = `Celda ${index + 1}`;
    const marker = new maplibregl.Marker({ element: markerElement })
      .setLngLat([(w + e) / 2, (s + n) / 2])
      .addTo(map);
    return () => {
      stop();
      marker.remove();
    };
    // Primitive pick ids only — cell object identity must not cancel a running lift.
    // Intentionally omit mode for the same reason.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, pickedSceneId, pickedIndex, scene.id]);

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
    <div
      className="map-shell"
      ref={shell}
      data-view-mode={mode}
      data-intro={intro}
      data-intro-title={titlePhase}
      data-fs-cinema={fsCinema}
    >
      <div className="map-presentation-controls">
        <button type="button" disabled={!loaded || introPlaying} onClick={() => {
          introDone.current = false;
          if (mode === "3d" && mapRef.current) playIntro(mapRef.current);
          else setMode("3d");
        }}>Ver introducción</button>
        <details className="map-filter-popover"><summary>Fechas y variable</summary>
          <div>{presentationControls}</div>
        </details>
        <div className="mode-switch" role="group" aria-label="Representación de los datos">
          <button type="button" aria-pressed={!differenceActive} onClick={() => setDifference(false)}>Valores</button>
          <button type="button" aria-pressed={differenceActive} disabled={!referenceScene || showDistrictOutlines}
            onClick={() => setDifference(true)}>Diferencias</button>
        </div>
        <details className="map-filter-popover map-color-popover"><summary>Color</summary>
        <div><label className="map-opacity">Intensidad del color
          <input aria-label="Intensidad del color" type="range" min="0.2" max="1" step="0.05"
            value={opacity} onChange={event => setOpacity(Number(event.target.value))} />
        </label></div></details>
      </div>
      <div className="map-stage">
        <MapClimate
          district={
            selectedDistrict && selectedCentroid
              ? {
                  number: selectedDistrict.number,
                  name: selectedDistrict.name,
                  boundaryVersion: selectedDistrict.boundary_version,
                  latitude: selectedCentroid.lat,
                  longitude: selectedCentroid.lng,
                }
              : null
          }
          onWeatherChange={(weather, loading) => {
            setDistrictWeather(weather);
            setDistrictWeatherLoading(loading);
          }}
        />
        {selectedDistrict && (
          <DistrictClimateFx
            weather={districtWeather}
            loading={districtWeatherLoading}
            districtName={selectedDistrict.name}
          />
        )}
        {!showDistrictOutlines && <aside className="map-data-key" aria-label="Leyenda de datos del mapa">
          <strong>{differenceActive ? "Diferencia de " : ""}{variable === "lst" ? "LST · °C" : "NDVI · sin unidad"}</strong>
          <span>{scene.acquired_at.slice(0, 10)}{differenceActive && referenceScene ? ` menos ${referenceScene.acquired_at.slice(0, 10)}` : ""}</span>
          <div className={`map-color-ramp ${differenceActive ? "difference" : variable}`} />
          <div className="map-scale-labels"><span>{differenceActive ? `−${scaleLimit}` : variable === "lst" ? "0" : "−1"}</span>
            <span>{differenceActive ? "0" : variable === "lst" ? "25" : "0"}</span>
            <span>{differenceActive ? `+${scaleLimit}` : variable === "lst" ? "50" : "1"}</span></div>
          <small>{differenceActive ? "Azul: disminución · rosa: aumento" : "Escala fija para todas las fechas"}. Extremos saturados.</small>
          <span>{displayedValues.length} / {scene.cells.length} celdas con datos</span>
          {displayedValues.length > 0 && <span>Rango: {Math.min(...displayedValues).toFixed(variable === "lst" ? 1 : 3)} a {Math.max(...displayedValues).toFixed(variable === "lst" ? 1 : 3)}</span>}
          <small>{differenceActive ? "Diferencia descriptiva; puede variar el soporte válido. No demuestra tendencia ni causalidad." : "Landsat · LST no es temperatura del aire."} {synthetic ? "Datos sintéticos." : ""}</small>
          {differenceActive && displayedValues.length === 0 && <strong>Sin celdas coincidentes con datos</strong>}
        </aside>}

        <div
          ref={container}
          className="study-map"
          role="region"
          aria-label="Mapa de observaciones; valores disponibles en la tabla inferior"
        />
        <button
          type="button"
          className="map-fs-toggle"
          onClick={toggleFullscreen}
          aria-pressed={fullscreen}
          aria-label={fullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
          title={fullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
          disabled={introPlaying || fsActive}
        >
          {fullscreen ? <FsExitIcon /> : <FsEnterIcon />}
        </button>
        <div
          className="valley-intro"
          aria-hidden={titlePhase === "off" && !introPlaying}
        >
          <p className="valley-intro-title">Cochabamba</p>
          {introPlaying && (
            <button
              type="button"
              className="valley-intro-skip"
              onClick={() => mapRef.current && endIntro(mapRef.current, true)}
            >
              Omitir
            </button>
          )}
        </div>
        {fsCinema !== "idle" && fsCinema !== "done" && (
          <div className="fs-cinema" aria-hidden={!fsActive}>
            <div className="fs-cinema-copy">
              <p className="fs-cinema-title">Cochabamba</p>
              <p>Microclimas urbanos con inteligencia artificial</p>
            </div>
            {fsActive && (
              <button
                type="button"
                className="fs-cinema-skip"
                onClick={() => {
                  endFsCinema();
                  setFsCinema("done");
                }}
              >
                Omitir
              </button>
            )}
          </div>
        )}
      </div>
      <div className="map-chrome-dock map-chrome" data-fs={fullscreen ? "on" : "off"}>
        <div className="map-view-cluster">
          <div className="mode-switch" role="group" aria-label="Vista del mapa">
            <button
              type="button"
              aria-pressed={mode === "3d"}
              disabled={introPlaying || fsActive}
              onClick={() => setMode("3d")}
            >
              3D
            </button>
            <button
              type="button"
              aria-pressed={mode === "2d"}
              disabled={introPlaying || fsActive}
              onClick={() => {
                setOrbiting(false);
                setMode("2d");
              }}
            >
              2D
            </button>
          </div>
          <div className="mode-switch" role="group" aria-label="Fondo del mapa">
            <button
              type="button"
              aria-pressed={basemap === "streets"}
              disabled={!loaded || introPlaying || fsActive}
              onClick={() => setBasemap("streets")}
            >
              Calles
            </button>
            <button
              type="button"
              aria-pressed={basemap === "satellite"}
              disabled={!loaded || introPlaying || fsActive}
              onClick={() => setBasemap("satellite")}
            >
              Satélite
            </button>
          </div>
          {mode === "3d" && (
            <div className="map-light-control">
              <ThemeToggle disabled={introPlaying || fsActive || lightBusy} />
            </div>
          )}
        </div>
        <div className="camera-tools" role="group" aria-label="Explorar el valle">
          <CellCombobox
            value={selectedDistrictName ? districts.findIndex(district => district.name === selectedDistrictName) : null}
            options={districts.map((district, index) => ({ value: index, label: district.name }))}
            disabled={!loaded || introPlaying || fsActive || districts.length === 0}
            onSelect={(index) => {
              if (index !== null) selectDistrict(index);
              else {
                closeDistrict();
              }
            }}
          />
          <div className="camera-tools-group" role="group" aria-label="Relieve">
            <button
              type="button"
              disabled={!loaded || mode !== "3d" || introPlaying || fsActive}
              aria-pressed={orbiting}
              onClick={() => setOrbiting(!orbiting)}
            >
              {orbiting ? "Detener giro" : "Girar"}
            </button>
          </div>
          <div className="camera-tools-group" role="group" aria-label="Encaje">
            <button type="button" disabled={!loaded || fsActive} onClick={resetCamera}>
              Centrar
            </button>
            {picked?.sceneId === scene.id && (
              <button
                type="button"
                disabled={!loaded || fsActive}
                onClick={() => {
                  const cell = scene.cells[picked.index];
                  if (!cell) return;
                  const [w, s, e, n] = cell.bounds;
                  mapRef.current?.easeTo({
                    center: [(w + e) / 2, (s + n) / 2],
                    duration: reducedMotion() ? 0 : 700,
                  });
                }}
              >
                Celda
              </button>
            )}
            {(overlayKey || placeInfo) && (
              <button type="button" disabled={!loaded || fsActive} onClick={showCoverage}>
                GAMC
              </button>
            )}
          </div>
        </div>
        <div className="map-evidence-label">
          <span
            className={`map-evidence-kind${
              showDistrictOutlines
                ? " is-observed"
                : synthetic
                  ? " is-synthetic"
                  : " is-observed"
            }`}
          >
            {showDistrictOutlines
              ? "GAMC oficial"
              : synthetic
                ? "Sintético"
                : "Landsat"}
          </span>
          <strong>
            {showDistrictOutlines
              ? districts[0]?.boundary_version ?? "distritos"
              : scene.acquired_at.slice(0, 10)}
          </strong>
          <span>
            {showDistrictOutlines
              ? `${districts.length} polígonos`
              : differenceActive
                ? `Diferencia: ±${scaleLimit}${variable === "lst" ? " °C" : " NDVI"}`
                : variable === "lst"
                ? "LST 0–50 °C"
                : "NDVI −1 a 1"}
          </span>
          {fullscreen && (
            <small>
              {showDistrictOutlines
                ? "Polígonos municipales reales. Pulsa uno para ver series aceptadas."
                : "Selecciona una celda para consultar sus datos."}
            </small>
          )}
        </div>
      </div>
      {!loaded && <p className="map-loading" role="status">Preparando el relieve y las observaciones…</p>}
      {fullscreenError && <p className="map-warning" role="status">El navegador no permite pantalla completa en esta ventana.</p>}
      <AnimatePresence>
      {selectedDistrict && <motion.aside key="district-info" className="district-selection-info" aria-live="polite"
        initial={reduceMotion ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: reduceMotion ? 0 : 8 }} transition={{ duration: reduceMotion ? 0 : .3 }}>
        <DistrictMunicipalBrief
          districtName={selectedDistrict.name}
          districtNumber={selectedDistrict.number}
          boundaryVersion={selectedDistrict.boundary_version}
          series={districtSeries}
          weather={districtWeather}
        />
        <InfoFields items={[
          ["Número", selectedDistrict.number],
          ["Fuente del límite", selectedDistrict.source_url],
          ["Versión territorial", selectedDistrict.boundary_version],
          ["Comuna (WMS)", place?.status === "ready" ? place.district?.Comuna : null],
        ]} />
        <small className="cell-inspector-note">
          Esta ficha está pensada para gestión municipal: priorizar, comparar y documentar.
          No convierte correlación en causalidad.
        </small>
        <button type="button" onClick={closeDistrict}>Cerrar selección</button>
      </motion.aside>}
      </AnimatePresence>
      <AnimatePresence>
      {(inspected || place) && (
        <motion.aside
          key="cell-inspector"
          className="cell-inspector"
          aria-label={inspected ? "Celda seleccionada" : "Punto seleccionado"}
          initial={reduceMotion ? false : { opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          exit={
            reduceMotion
              ? undefined
              : { opacity: 0, x: 8, transition: { duration: 0.18 } }
          }
          transition={{
            duration: reduceMotion ? 0 : 0.25,
            ease: [0.22, 1, 0.36, 1],
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") closeDetail();
          }}
        >
          <div>
            <strong>
              {inspected
                ? `Celda ${(picked?.index ?? 0) + 1} · Superficie observada`
                : "Contexto municipal"}
            </strong>
            <button
              type="button"
              onClick={closeDetail}
              aria-label={
                inspected
                  ? "Cerrar y deseleccionar celda"
                  : "Cerrar detalle del punto"
              }
            >
              ×
            </button>
          </div>
          {inspected && (
            <>
              <p className="cell-inspector-meta">
                <time dateTime={scene.acquired_at}>{scene.acquired_at.slice(0, 10)}</time>
                <span>Valor de celda · no es la media territorial</span>
              </p>
              <dl className="cell-inspector-metrics">
                {<div className="metric-lst">
                  <dt>LST</dt>
                  <dd>
                    {inspected.lst == null
                      ? "No disponible"
                      : `${inspected.lst.toFixed(1)} °C`}
                  </dd>
                </div>}
                {<div className="metric-ndvi">
                  <dt>NDVI</dt>
                  <dd>
                    {inspected.ndvi == null
                      ? "No disponible"
                      : inspected.ndvi.toFixed(3)}
                  </dd>
                </div>}
              </dl>
              {differenceActive && <p className="cell-difference">
                Diferencia de {variable === "lst" ? "LST" : "NDVI"}: {(() => {
                  const before = referenceCells.get(cellKey(inspected.bounds))?.[variable];
                  const after = inspected[variable];
                  return before == null || after == null ? "Sin datos comparables" : `${after - before > 0 ? "+" : ""}${(after - before).toFixed(variable === "lst" ? 1 : 3)}${variable === "lst" ? " °C" : ""}`;
                })()}
              </p>}
              <dl className="cell-inspector-facts">
                <div>
                  <dt>Naturaleza</dt>
                  <dd>{synthetic ? "Dato sintético" : "Observación"}</dd>
                </div>
                <div>
                  <dt>Cobertura escena</dt>
                  <dd>{(scene.valid_fraction * 100).toFixed(1)} % válida</dd>
                </div>
                <div>
                  <dt>Plataforma</dt>
                  <dd>{scene.platform}</dd>
                </div>
                <div>
                  <dt>Centro</dt>
                  <dd>
                    {(
                      (inspected.bounds[1] + inspected.bounds[3]) /
                      2
                    ).toFixed(5)}
                    ,{" "}
                    {(
                      (inspected.bounds[0] + inspected.bounds[2]) /
                      2
                    ).toFixed(5)}
                  </dd>
                </div>
              </dl>
              <small className="cell-inspector-note">
                Celda de la ventana de estudio, no un distrito. LST es temperatura
                superficial, no del aire. La elevación visual solo marca la selección.
              </small>
              <div className="cell-inspector-actions">
                {onRequestEvidence && (
                  <button
                    type="button"
                    className="evidence-trigger"
                    onClick={onRequestEvidence}
                  >
                    Ver evidencia
                  </button>
                )}
                <button type="button" onClick={closeDetail}>
                  Deseleccionar
                </button>
              </div>
            </>
          )}
          {place && (
            <section className="place-context" aria-live="polite">
              {inspected && <strong>Contexto municipal</strong>}
              {place.status === "loading" && <p>Consultando las capas del GAMC…</p>}
              {place.status === "outside" && (
                <p>Fuera de la cobertura publicada de las capas GAMC.</p>
              )}
              {place.status === "error" && (
                <p>No se pudo consultar el servicio municipal en este punto.</p>
              )}
              {place.status === "ready" && (
                <>
                  <InfoFields items={[
                    ["Distrito", place.district?.Distrito],
                    ["Comuna", place.district?.Comuna],
                    ["Personas · manzana", place.block?.Personas],
                    ["Viviendas · manzana", place.block?.Viviendas],
                    ["Densidad · manzana", place.block?.Densidad],
                  ]} />
                  <small className="cell-inspector-note">
                    GAMC por punto. No publica año ni unidades de densidad. Es
                    contexto: no explica LST ni NDVI.
                  </small>
                </>
              )}
            </section>
          )}
        </motion.aside>
      )}
      </AnimatePresence>
      {overlayKey && outsideCoverage && (
        <p className="map-warning" role="status">
          La vista está fuera de la cobertura de las capas GAMC.{" "}
          <button type="button" onClick={showCoverage}>Ir a la cobertura</button>
        </p>
      )}
      {contextLost && <p className="map-warning" role="alert">Se perdió el contexto gráfico. Consulta la tabla de observaciones o recarga el mapa.</p>}
      {basemap === "satellite" && <p className="basemap-note">Fondo Esri de referencia: su fecha puede diferir de la adquisición Landsat seleccionada.</p>}
      {baseError && (
        <p className="map-warning" role="status">
          No se pudo cargar parte del mapa. La tabla sigue disponible.
        </p>
      )}
      <noscript>Consulta la tabla de observaciones.</noscript>
    </div>
  );
}
