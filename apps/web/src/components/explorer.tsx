"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Evidence, Territories } from "../lib/api";
import type { OfficialDistrict } from "../lib/districts-geojson";
import { findMatchingCellIndex } from "../lib/cell-identity";
import { useCurrentPathname } from "../lib/current-pathname";
import {
  filtersToQuery,
  type ExplorerFilters,
  type Variable,
} from "../lib/filters";
import { GAMC_BLOCKS_ID, GAMC_DISTRICTS_ID } from "../lib/gamc";
import { territoryOptions } from "../lib/territory";
import { CompareCurtain } from "./compare-curtain";
import { DateComparison } from "./date-comparison";
import {
  EvidenceDrawer,
  EvidenceTrigger,
  type EvidenceFocus,
} from "./evidence-drawer";
import { SceneTimeline } from "./scene-timeline";
import { MapLayers } from "./map-layers";
import { ObservationChart } from "./observation-chart";
import { ProvenancePanel } from "./provenance-panel";
import { StudyMapClient as StudyMap } from "./study-map-client";
import { TerritoryCard } from "./territory-card";
import { TerritorySelector } from "./territory-selector";
import { VariableSwitch } from "./variable-switch";
import { NatureBadge } from "./ui/nature-badge";
import { Panel } from "./ui/panel";
import { SignalGauge } from "./ui/signal-gauge";
import { StatusPanel } from "./ui/status-panel";
const format = (value: number | null | undefined, digits = 2) =>
  value == null ? "Sin datos" : value.toFixed(digits);

type CopyState = "idle" | "copied" | "failed";
type CellSelection = { sceneId: string; index: number; bounds: [number, number, number, number] };

export function Explorer({
  evidence,
  synthetic,
  initial,
  notices,
  catalog,
  districts,
}: {
  evidence: Evidence;
  synthetic: boolean;
  initial: ExplorerFilters;
  notices: string[];
  catalog: Territories | null;
  districts: OfficialDistrict[];
}) {
  const pathname = useCurrentPathname();
  const [filters, setFilters] = useState(initial);
  const [copy, setCopy] = useState<CopyState>("idle");
  const [overlays, setOverlays] = useState<string[]>([]);
  const [failedOverlays, setFailedOverlays] = useState<string[]>([]);
  const [picked, setPicked] = useState<CellSelection | null>(null);
  // Stable identity so StudyMap does not restart the cell-lift animation every render.
  const pickedSceneId = picked?.sceneId ?? null;
  const pickedIndex = picked?.index ?? -1;
  const mapSelectedCell = useMemo(
    () =>
      pickedSceneId != null && pickedIndex >= 0
        ? { sceneId: pickedSceneId, index: pickedIndex }
        : null,
    [pickedSceneId, pickedIndex],
  );
  const [selectionNote, setSelectionNote] = useState<string | null>(null);
  const [curtain, setCurtain] = useState(false);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [evidenceFocus, setEvidenceFocus] = useState<EvidenceFocus | null>(null);
  const [mapShell, setMapShell] = useState<HTMLElement | null>(null);
  const [displayVariable, setDisplayVariable] = useState<Variable>(initial.variable);
  const [layerPhase, setLayerPhase] = useState<"idle" | "out" | "in">("idle");

  const update = (change: Partial<ExplorerFilters>) => {
    const next = { ...filters, ...change };
    if (next.compareId === next.sceneId) next.compareId = null;
    if (change.sceneId && change.sceneId !== filters.sceneId && picked) {
      const nextScene = evidence.scenes.find((s) => s.id === change.sceneId);
      if (!nextScene) {
        setPicked(null);
        setSelectionNote("La adquisición seleccionada no está disponible.");
      } else {
        const match = findMatchingCellIndex(nextScene.cells, picked.bounds);
        if (match == null) {
          setPicked(null);
          setSelectionNote(
            "No se pudo identificar la misma celda en la nueva fecha; la selección se ha liberado.",
          );
        } else {
          const cell = nextScene.cells[match];
          setPicked({ sceneId: nextScene.id, index: match, bounds: cell.bounds });
          setSelectionNote(null);
        }
      }
    }
    setFilters(next);
    setCopy("idle");
    window.history.replaceState(null, "", `${pathname}?${filtersToQuery(next)}`);
  };

  const changeVariable = (variable: Variable) => {
    if (variable === filters.variable) return;
    update({ variable });
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setDisplayVariable(variable);
      setLayerPhase("idle");
      return;
    }
    setLayerPhase("out");
    window.setTimeout(() => {
      setDisplayVariable(variable);
      setLayerPhase("in");
      window.setTimeout(() => setLayerPhase("idle"), 160);
    }, 140);
  };

  const copyLink = async () => {
    const url = `${window.location.origin}${pathname}?${filtersToQuery(filters)}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopy("copied");
    } catch {
      setCopy("failed");
    }
  };
  const toggleOverlay = (id: string, on: boolean) => {
    setFailedOverlays((current) => current.filter((x) => x !== id));
    setOverlays((current) =>
      on ? [...current.filter((x) => x !== id), id] : current.filter((x) => x !== id),
    );
  };
  const overlayFailed = (id: string) =>
    setFailedOverlays((current) => (current.includes(id) ? current : [...current, id]));

  const placeInfo = [GAMC_DISTRICTS_ID, GAMC_BLOCKS_ID].every((id) =>
    catalog?.wms_layers.some((layer) => layer.service_id === id && layer.status === "available"),
  );

  const { variable } = filters;
  const selected = Math.max(
    0,
    evidence.scenes.findIndex((s) => s.id === filters.sceneId),
  );
  const scene = evidence.scenes[selected];
  if (!scene)
    return (
      <StatusPanel status="empty" title="No hay escenas publicadas para esta área">
        <p>El snapshot existe, pero no contiene adquisiciones válidas.</p>
      </StatusPanel>
    );
  const compared = evidence.scenes.find((s) => s.id === filters.compareId) ?? null;
  const lst = displayVariable === "lst";
  const date = scene.acquired_at.slice(0, 10);
  const mean = lst ? scene.lst_mean : scene.ndvi_mean;
  const activePicked =
    picked?.sceneId === scene.id ? scene.cells[picked.index] ?? null : null;

  const openEvidence = (focus: EvidenceFocus) => {
    setEvidenceFocus(focus);
    setEvidenceOpen(true);
  };

  const showDistrictOutlines =
    filters.territory === "distritos" && districts.length > 0;

  const onPickCell = (next: { sceneId: string; index: number } | null) => {
    if (!next) {
      setPicked(null);
      setSelectionNote(null);
      return;
    }
    if (picked?.sceneId === next.sceneId && picked.index === next.index) {
      setPicked(null);
      setSelectionNote(null);
      return;
    }
    // Always a Landsat cell — district outlines never replace click-to-lift.
    const cell = evidence.scenes.find((s) => s.id === next.sceneId)?.cells[next.index];
    if (!cell) {
      setPicked(null);
      return;
    }
    setPicked({ sceneId: next.sceneId, index: next.index, bounds: cell.bounds });
    setSelectionNote(null);
  };

  return (
    <div className="evidence-workbench">
      <nav className="explorer-index" aria-label="En esta página"><a href="#mapa">Explorar el mapa</a><a href="#historial">Comparar fechas</a><a href="#fuentes">Fuentes y límites</a></nav>
      <div className="explorer-toolbar">
        <TerritorySelector
          options={territoryOptions(evidence, catalog)}
          value={filters.territory}
          onChange={(territory) => {
            setPicked(null);
            setSelectionNote(null);
            setCurtain(false);
            update({ territory });
          }}
        />
      <section className="controls" aria-label="Filtros">
        <div className="field">
          <label htmlFor="scene">Fecha de adquisición</label>
          <select
            id="scene"
            value={scene.id}
            onChange={(e) => update({ sceneId: e.target.value })}
          >
            {evidence.scenes.map((s) => (
              <option key={s.id} value={s.id}>
                {s.acquired_at.slice(0, 10)}, {s.platform}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="compare">Comparar con</label>
          <select
            id="compare"
            value={filters.compareId ?? ""}
            disabled={evidence.scenes.length < 2}
            onChange={(e) => {
              const compareId = e.target.value || null;
              update({ compareId });
              if (!compareId) setCurtain(false);
            }}
          >
            <option value="">Sin comparación</option>
            {evidence.scenes
              .filter((s) => s.id !== scene.id)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.acquired_at.slice(0, 10)}, {s.platform}
                </option>
              ))}
          </select>
          {compared && (
            <button
              type="button"
              className="evidence-trigger"
              onClick={() => setCurtain((value) => !value)}
            >
              {curtain ? "Cerrar cortina espacial" : "Abrir cortina espacial"}
            </button>
          )}
          {!compared && evidence.scenes.length >= 2 && (
            <small>
              Elige una segunda fecha para comparar medias o abrir la cortina de celdas
              georreferenciadas.
            </small>
          )}
        </div>
        <div className="field">
          <span className="field-label">Compartir</span>
          <button type="button" onClick={copyLink}>
            Copiar enlace a esta vista
          </button>
          <small aria-live="polite">
            {copy === "copied"
              ? "Enlace copiado. Incluye territorio, fechas y variable."
              : copy === "failed"
                ? "No se pudo copiar. Copia la dirección del navegador; ya incluye los filtros."
                : "El enlace conserva territorio, fechas y variable."}
          </small>
          <Link href={`/informes?contenido=escenas&escena=${encodeURIComponent(scene.id)}`}>
            Descargar los datos de esta fecha
          </Link>
        </div>
      </section>
      </div>
      <div id="mapa" className="observatory-view" data-layer-phase={layerPhase}>
        {!curtain ? (
          <section className="stage" aria-label={`Valle de Cochabamba, ${date}`}>
            <StudyMap
              scene={scene}
              referenceScene={compared ?? null}
              presentationControls={<>
                <label>Fecha del mapa<select aria-label="Fecha del mapa" value={scene.id} onChange={event => update({ sceneId: event.target.value })}>
                  {evidence.scenes.map(item => <option key={item.id} value={item.id}>{item.acquired_at.slice(0, 10)}</option>)}
                </select></label>
                <label>Fecha de referencia<select aria-label="Fecha de referencia" value={compared?.id ?? ""} onChange={event => update({ compareId: event.target.value })}>
                  <option value="">Selecciona para ver cambios</option>
                  {evidence.scenes.filter(item => item.id !== scene.id).map(item => <option key={item.id} value={item.id}>{item.acquired_at.slice(0, 10)}</option>)}
                </select></label>
                <label>Dato del mapa<select aria-label="Dato del mapa" value={variable} onChange={event => changeVariable(event.target.value as Variable)}>
                  <option value="lst">Temperatura superficial</option><option value="ndvi">Vegetación · NDVI</option>
                </select></label>
              </>}
              variable={displayVariable}
              bounds={evidence.bounds}
              territory={filters.territory}
              districts={districts}
              overlays={overlays}
              onOverlayError={overlayFailed}
              synthetic={synthetic}
              placeInfo={placeInfo}
              selectedCell={
                mapSelectedCell?.sceneId === scene.id ? mapSelectedCell : null
              }
              onSelectCell={onPickCell}
              onShellElement={setMapShell}
              onRequestEvidence={() => {
                if (!activePicked || !picked) return;
                openEvidence({
                  kind: "cell",
                  scene,
                  cell: activePicked,
                  cellIndex: picked.index,
                  variable: displayVariable,
                });
              }}
            />
            <div className="hud">
              <div className="hud-context">
                <span className="observatory-mark" aria-hidden="true" />
                {showDistrictOutlines
                  ? `${districts.length} distritos oficiales GAMC`
                  : "Ventana piloto Landsat (no son distritos)"}
              </div>
              <VariableSwitch value={variable} onChange={changeVariable} />
              <p className="hud-date">
                <time dateTime={scene.acquired_at}>{date}</time>, {scene.platform}
              </p>
              <p className="hud-value" data-variable={displayVariable}>
                {mean == null ? "Sin datos" : mean.toFixed(lst ? 1 : 3)}
                {mean != null && lst && <small> °C</small>}
              </p>
              <p className="hud-label">
                {lst ? "Temperatura superficial media" : "NDVI medio"} de los
                píxeles válidos
              </p>
              <div className="legend">
                <span>{lst ? "0 °C" : "−1"}</span>
                <div className={lst ? "gradient heat" : "gradient green"} />
                <span>{lst ? "50 °C" : "1"}</span>
              </div>
              <details className="hud-method">
                <summary>Cómo leer el mapa</summary>
                <p className="hud-note">
                  {showDistrictOutlines
                    ? "Se dibujan los 15 polígonos oficiales del GAMC (límites irregulares reales). La cuadrícula blanca de celdas Landsat queda oculta aquí para no confundirla con distritos. Sin LST/NDVI distrital inventado."
                    : "El color representa la variable seleccionada en celdas de unos 360 m. Las celdas sin valor quedan transparentes. Selecciona una para ver LST, NDVI y cobertura."}
                </p>
              </details>
              <dl className="map-readouts">
                <div><dt>LST · superficie</dt><dd>{format(scene.lst_mean, 1)} °C</dd></div>
                <div><dt>NDVI · vegetación</dt><dd>{format(scene.ndvi_mean, 3)}</dd></div>
                <div><dt>Cobertura válida</dt><dd>{format(scene.valid_fraction * 100, 1)} %</dd></div>
              </dl>
              <p className="caption">Selecciona una celda para consultar sus valores y procedencia. Las medias corresponden a la ventana piloto.</p>
              <EvidenceTrigger
                onClick={() =>
                  openEvidence({ kind: "scene", scene, variable: displayVariable })
                }
              />
            </div>
          </section>
        ) : compared ? (
          <CompareCurtain
            left={scene}
            right={compared}
            variable={displayVariable}
            bounds={evidence.bounds}
            synthetic={synthetic}
            onExit={() => setCurtain(false)}
          />
        ) : (
          <StatusPanel status="empty" title="Falta la segunda adquisición">
            <p>Elige una fecha en «Comparar con» para abrir la cortina espacial.</p>
            <button type="button" onClick={() => setCurtain(false)}>
              Volver al mapa
            </button>
          </StatusPanel>
        )}
        {!curtain && (
          <SceneTimeline
            scenes={evidence.scenes}
            selectedId={scene.id}
            onSelect={(sceneId) => update({ sceneId })}
          />
        )}
      </div>
      {selectionNote && (
        <p className="selection-status" role="status">
          {selectionNote}
        </p>
      )}
      {notices.length > 0 && (
        <div className="link-notice" role="status">
          <p>Algunos filtros del enlace no se pudieron aplicar:</p>
          <ul>
            {notices.map((notice) => (
              <li key={notice}>{notice}</li>
            ))}
          </ul>
        </div>
      )}
      <header className="evidence-heading" id="indicadores">
        <div>
          <p className="section-kicker">
            <span className="signal-dot signal-coverage" aria-hidden="true" />
            Adquisición seleccionada
          </p>
          <h2>La superficie, en cifras</h2>
        </div>
        <div>
          <time dateTime={scene.acquired_at}>{date} UTC</time>
          <NatureBadge nature={synthetic ? "synthetic" : "observed"} detailed />
        </div>
      </header>
      <section
        key={scene.id}
        className="metrics presentation-metrics vital-signs"
        aria-label={`Indicadores del ${date}`}
      >
        <article className="metric metric-signal" data-signal="heat">
          <p className="metric-label">
            <span className="signal-chip signal-heat">LST</span>
            LST media válida
          </p>
          <p className={scene.lst_mean == null ? "metric-value metric-missing" : "metric-value"}>
            {scene.lst_mean == null ? "Sin datos" : scene.lst_mean.toFixed(1)}
            {scene.lst_mean != null && <small> °C</small>}
          </p>
          <SignalGauge signal="heat" value={scene.lst_mean} min={0} max={50} unit=" °C" />
          <p className="metric-note">Temperatura de la superficie al paso del satélite</p>
          <div className="metric-actions">
            <EvidenceTrigger
              onClick={() =>
                openEvidence({ kind: "metric", scene, variable: "lst", metric: "lst" })
              }
            />
          </div>
        </article>
        <article className="metric metric-signal" data-signal="vegetation">
          <p className="metric-label">
            <span className="signal-chip signal-vegetation">NDVI</span>
            NDVI medio válido
          </p>
          <p className={scene.ndvi_mean == null ? "metric-value metric-missing" : "metric-value"}>
            {scene.ndvi_mean == null ? "Sin datos" : scene.ndvi_mean.toFixed(3)}
          </p>
          <SignalGauge signal="vegetation" value={scene.ndvi_mean} min={-1} max={1} />
          <p className="metric-note">Índice sin unidad, de −1 a 1</p>
          <div className="metric-actions">
            <EvidenceTrigger
              onClick={() =>
                openEvidence({ kind: "metric", scene, variable: "ndvi", metric: "ndvi" })
              }
            />
          </div>
        </article>
        <article className="metric metric-signal" data-signal="coverage">
          <p className="metric-label">
            <span className="signal-chip signal-coverage">QA</span>
            Cobertura válida
          </p>
          <p className="metric-value">
            {(scene.valid_fraction * 100).toFixed(1)}
            <small> %</small>
          </p>
          <SignalGauge
            signal="coverage"
            value={scene.valid_fraction * 100}
            min={0}
            max={100}
            unit="%"
          />
          <p className="metric-note">
            {scene.valid_pixels.toLocaleString("es-BO")} de{" "}
            {scene.total_pixels.toLocaleString("es-BO")} píxeles
          </p>
          <div className="metric-actions">
            <EvidenceTrigger
              onClick={() =>
                openEvidence({
                  kind: "metric",
                  scene,
                  variable: displayVariable,
                  metric: "coverage",
                })
              }
            />
          </div>
        </article>
      </section>
      <header className="evidence-heading" id="territorio">
        <div>
          <p className="section-kicker">
            <span className="signal-dot signal-ground" aria-hidden="true" />
            Alcance espacial
          </p>
          <h2>El territorio de esta observación</h2>
        </div>
      </header>
      <div className="territory">
        <TerritoryCard
          evidence={evidence}
          territory={filters.territory}
          districts={districts}
        />
      </div>
      <details className="reference-details"><summary>Capas municipales y guía de interpretación</summary>
      <div className="workspace">
        <Panel title="Capas de referencia" meta={date} className="map-panel">
          <p className="caption">
            {showDistrictOutlines
              ? "Mapa centrado en los 15 distritos oficiales GAMC. Las capas WMS solo orientan; no hay LST/NDVI distrital inventado."
              : "El rectángulo de celdas es una ventana de estudio Landsat, no un límite municipal."}
          </p>
          <MapLayers
            layers={catalog?.wms_layers ?? []}
            catalogError={!catalog}
            active={overlays}
            failed={failedOverlays}
            onToggle={toggleOverlay}
          />
        </Panel>
        <aside className="panel reading-panel">
          <h2>Cómo leer estas cifras</h2>
          <p>
            Cada valor corresponde a un día concreto de julio. Las diferencias entre
            fechas pueden deberse al clima de ese día y a las condiciones de
            adquisición.
          </p>
          <div className="note">
            La temperatura superficial no equivale a la temperatura del aire.
          </div>
          <h3>¿Hay una tendencia?</h3>
          {!synthetic && evidence.scenes.length === 12 && evidence.scenes[0]?.acquired_at.startsWith("2014") ? (
            <p>El análisis exploratorio 2014–2025 evalúa el cambio por año y su
              significancia en LST y NDVI. <Link href="/analisis">Ver resultados, intervalos y datos</Link>.
              El mapa usa medias por escena; las pruebas usan soporte común.</p>
          ) : <p>Las diferencias entre estas fechas son descriptivas. <Link href="/comparar">Consultar series distritales aceptadas</Link>.</p>}
          <h3>Calidad de esta escena</h3>
          <div
            className="quality-meter"
            data-level={
              scene.valid_fraction === 0
                ? "empty"
                : scene.valid_fraction < 0.7
                  ? "caution"
                  : "ok"
            }
          >
            <div className="quality-meter-track" aria-hidden="true">
              <span
                className="quality-meter-fill"
                style={{ width: `${Math.min(100, scene.valid_fraction * 100)}%` }}
              />
            </div>
            <p className={scene.valid_fraction < 0.7 ? "warning" : undefined}>
              {scene.valid_fraction === 0
                ? "Esta escena no tiene píxeles válidos: no hay valores que interpretar."
                : scene.valid_fraction < 0.7
                  ? "Cobertura reducida: interpreta estos valores con especial cautela."
                  : "Revisa siempre la cobertura válida y las limitaciones del producto."}
            </p>
          </div>
        </aside>
      </div>
      </details>
      <DateComparison scenes={evidence.scenes} />
      <div id="historial" className="history-section">
      <Panel
        title="Observaciones en el tiempo"
        meta={`${lst ? "LST en °C" : "NDVI sin unidad"}, media de píxeles válidos`}
        className={`history ${lst ? "history-heat" : "history-vegetation"}`}
      >
        <div className="history-composition">
        <div className="history-plot">
        <ObservationChart
          scenes={evidence.scenes}
          variable={displayVariable}
          selectedId={scene.id}
          selectedCellBounds={picked?.bounds ?? null}
        />
        </div>
        <div className="table-wrap" tabIndex={0} role="region" aria-label="Observaciones, tabla desplazable">
          <table>
            <caption>
              Comparación descriptiva entre adquisiciones, con todos los valores
              disponibles
            </caption>
            <thead>
              <tr>
                <th scope="col">Fecha (UTC)</th>
                <th scope="col">LST (°C)</th>
                <th scope="col">NDVI</th>
                <th scope="col">Cobertura válida</th>
              </tr>
            </thead>
            <tbody>
              {evidence.scenes.map((s) => (
                <tr key={s.id} aria-current={s.id === scene.id ? "true" : undefined}>
                  <td><button type="button" className="acquisition-select" aria-pressed={s.id === scene.id} onClick={() => update({ sceneId: s.id })}>{s.acquired_at.slice(0, 10)}</button></td>
                  <td>{format(s.lst_mean)}</td>
                  <td>{format(s.ndvi_mean, 3)}</td>
                  <td>{format(s.valid_fraction * 100, 1)} %</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </div>
        <p><Link href="/comparar">Consultar indicadores y series por distrito</Link></p>
      </Panel>
      </div>
      <div id="fuentes" />
      <ProvenancePanel evidence={evidence} scene={scene} synthetic={synthetic} />
      <EvidenceDrawer
        open={evidenceOpen}
        onClose={() => setEvidenceOpen(false)}
        evidence={evidence}
        focus={evidenceFocus}
        synthetic={synthetic}
        portalRoot={
          typeof document !== "undefined" &&
          mapShell &&
          document.fullscreenElement === mapShell
            ? mapShell
            : null
        }
      />
    </div>
  );
}
