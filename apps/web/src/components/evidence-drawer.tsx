"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { Evidence } from "../lib/api";
import type { Variable } from "../lib/filters";
import { boundsSizeKm } from "../lib/territory";
import { NatureBadge } from "./ui/nature-badge";

type Scene = Evidence["scenes"][number];
type Cell = Scene["cells"][number];

export type EvidenceFocus =
  | { kind: "scene"; scene: Scene; variable: Variable }
  | { kind: "cell"; scene: Scene; cell: Cell; cellIndex: number; variable: Variable }
  | { kind: "metric"; scene: Scene; variable: Variable; metric: "lst" | "ndvi" | "coverage" };

function cellSizeLabel(scene: Scene): string {
  const cell = scene.cells[0];
  if (!cell) return "No disponible";
  const { width, height } = boundsSizeKm(cell.bounds);
  return `≈ ${Math.round(width * 1000)} m × ${Math.round(height * 1000)} m (calculado de los límites publicados)`;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="evidence-field">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/** Non-modal provenance panel: does not trap focus or block the rest of the app. */
export function EvidenceDrawer({
  open,
  onClose,
  evidence,
  focus,
  synthetic,
  portalRoot,
}: {
  open: boolean;
  onClose: () => void;
  evidence: Evidence;
  focus: EvidenceFocus | null;
  synthetic: boolean;
  /** When set (e.g. fullscreen shell), render inside that element. */
  portalRoot?: HTMLElement | null;
}) {
  const reduced = useReducedMotion();
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const triggerReturn = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    triggerReturn.current = document.activeElement as HTMLElement | null;
    const id = window.setTimeout(() => closeRef.current?.focus(), 50);
    return () => window.clearTimeout(id);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (open) return;
    const previous = triggerReturn.current;
    if (previous && document.contains(previous)) previous.focus();
  }, [open]);

  const scene = focus?.scene;
  const variable = focus?.variable ?? "lst";
  const lst = variable === "lst";
  const nature = synthetic ? "synthetic" : "observed";

  let showing = "No disponible";
  let valueLabel = "No disponible";
  if (focus?.kind === "cell") {
    showing = `Celda ${focus.cellIndex + 1} de la área de estudio`;
    const value = focus.cell[variable];
    valueLabel =
      value == null
        ? "No disponible"
        : lst
          ? `${value.toFixed(1)} °C`
          : value.toFixed(3);
  } else if (focus?.kind === "metric") {
    showing =
      focus.metric === "coverage"
        ? "Cobertura válida de la escena"
        : focus.metric === "lst"
          ? "Media territorial de LST (área de estudio)"
          : "Media territorial de NDVI (área de estudio)";
    if (focus.metric === "coverage") {
      valueLabel = `${(focus.scene.valid_fraction * 100).toFixed(1)} %`;
    } else if (focus.metric === "lst") {
      valueLabel =
        focus.scene.lst_mean == null ? "No disponible" : `${focus.scene.lst_mean.toFixed(1)} °C`;
    } else {
      valueLabel =
        focus.scene.ndvi_mean == null ? "No disponible" : focus.scene.ndvi_mean.toFixed(3);
    }
  } else if (focus?.kind === "scene" && scene) {
    showing = `Media de ${lst ? "LST" : "NDVI"} en la área de estudio`;
    const mean = lst ? scene.lst_mean : scene.ndvi_mean;
    valueLabel =
      mean == null ? "No disponible" : lst ? `${mean.toFixed(1)} °C` : mean.toFixed(3);
  }

  const panel = (
    <AnimatePresence>
      {open && focus && scene && (
        <motion.aside
          className="evidence-drawer"
          role="complementary"
          aria-labelledby={titleId}
          initial={reduced ? false : { opacity: 0, x: 18 }}
          animate={{ opacity: 1, x: 0 }}
          exit={reduced ? undefined : { opacity: 0, x: 12 }}
          transition={{ duration: reduced ? 0 : 0.27, ease: [0.22, 1, 0.36, 1] }}
        >
          <header className="evidence-drawer-head">
            <h2 id={titleId}>Evidencia</h2>
            <button type="button" ref={closeRef} onClick={onClose} aria-label="Cerrar panel de evidencia">
              Cerrar
            </button>
          </header>
          <p className="evidence-lead">Qué se muestra y de dónde sale, con los campos publicados.</p>

          <section aria-labelledby={`${titleId}-dato`}>
            <h3 id={`${titleId}-dato`}>El dato</h3>
            <dl className="evidence-fields">
              <Field label="Qué se muestra">{showing}</Field>
              <Field label="Alcance espacial">
                Área de estudio «{evidence.area_name}»; no es un límite administrativo.
              </Field>
              <Field label="Naturaleza">
                <NatureBadge nature={nature} />
                {nature === "synthetic"
                  ? " Dato sintético de demostración."
                  : " Observación satelital."}
              </Field>
              <Field label="Valor">{valueLabel}</Field>
              <Field label="Unidad">
                {focus.kind === "metric" && focus.metric === "coverage"
                  ? "Porcentaje de píxeles válidos"
                  : lst
                    ? "°C (temperatura superficial, no del aire)"
                    : "Índice adimensional (−1 a 1)"}
              </Field>
              <Field label="Adquisición">
                {scene.acquired_at.replace("T", " ").slice(0, 16)} UTC · {scene.platform}
              </Field>
            </dl>
          </section>

          <section aria-labelledby={`${titleId}-origen`}>
            <h3 id={`${titleId}-origen`}>Procedencia</h3>
            <dl className="evidence-fields">
              <Field label="Fuente">USGS / NASA Landsat vía colección publicada</Field>
              <Field label="Colección">
                <span className="code">{evidence.collection}</span>
              </Field>
              <Field label="Producto / versión">{evidence.product_version}</Field>
              <Field label="Licencia">{evidence.license}</Field>
              <Field label="Escena">
                <span className="code">{scene.id}</span>
              </Field>
              <Field label="Tamaño de celda del mapa">{cellSizeLabel(scene)}</Field>
              <Field label="Resolución nativa">
                No incluida en el snapshot; no se infiere del tamaño visual de las celdas.
              </Field>
              <Field label="Cobertura válida">
                {(scene.valid_fraction * 100).toFixed(1)} % (
                {scene.valid_pixels.toLocaleString("es-BO")} de{" "}
                {scene.total_pixels.toLocaleString("es-BO")} píxeles tras la máscara de calidad)
              </Field>
              <Field label="QA">
                Máscara de calidad aplicada en el procesamiento publicado; detalle adicional no
                disponible en el contrato.
              </Field>
              <Field label="Método">{evidence.method || "No disponible"}</Field>
              <Field label="Limitaciones">
                {evidence.limitations.length > 0 ? (
                  <ul>
                    {evidence.limitations.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : (
                  "No disponible"
                )}
              </Field>
              <Field label="Registro de origen">
                <a href={scene.source_url} target="_blank" rel="noreferrer">
                  Abrir registro STAC
                  <span className="sr-only"> (se abre en una pestaña nueva)</span>
                </a>
              </Field>
              <Field label="Snapshot">
                Generado el {evidence.generated_at.slice(0, 10)}
                {synthetic ? " (datos sintéticos)" : ""}
              </Field>
            </dl>
          </section>
        </motion.aside>
      )}
    </AnimatePresence>
  );

  if (portalRoot) return createPortal(panel, portalRoot);
  return panel;
}

export function EvidenceTrigger({
  onClick,
  label = "Ver evidencia",
}: {
  onClick: () => void;
  label?: string;
}) {
  return (
    <button type="button" className="evidence-trigger" onClick={onClick}>
      {label}
    </button>
  );
}
