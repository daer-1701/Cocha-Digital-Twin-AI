"use client";

import { useState } from "react";
import type { Evidence } from "../lib/api";
import { ExternalLink, safeExternalUrl } from "./ui/external-link";
import { Panel } from "./ui/panel";

const questions = [
  { id: "values", text: "¿Qué se observó en esta fecha?" },
  { id: "quality", text: "¿Qué limitaciones debo considerar?" },
  { id: "interpretation", text: "¿Puedo hablar de cambio climático?" },
] as const;

export function EvidenceGuide({ evidence, synthetic }: { evidence: Evidence; synthetic: boolean }) {
  const ordered = [...evidence.scenes].sort((a, b) => a.acquired_at.localeCompare(b.acquired_at));
  const [sceneId, setSceneId] = useState(ordered.at(-1)?.id ?? "");
  const [question, setQuestion] = useState<string>("values");
  const scene = ordered.find((item) => item.id === sceneId);
  const source = safeExternalUrl(scene?.source_url);
  if (!scene) return null;
  return <Panel title="Preguntas sobre la evidencia" meta="Lectura guiada sin IA">
    <p>Respuestas construidas con los campos publicados y explicaciones fijas. Este panel no usa Gemini ni consume presupuesto.</p>
    {synthetic && <p className="warning">Esta evidencia es sintética y sirve únicamente para demostrar la interfaz.</p>}
    <label htmlFor="guide-scene">Adquisición que quieres consultar</label>{" "}
    <select id="guide-scene" value={sceneId} onChange={(event) => setSceneId(event.target.value)}>
      {ordered.map((item) => <option key={item.id} value={item.id}>{item.acquired_at.slice(0, 10)}</option>)}
    </select>
    <div className="guide-questions" role="group" aria-label="Preguntas disponibles">
      {questions.map((item) => <button type="button" key={item.id} aria-pressed={question === item.id}
        onClick={() => setQuestion(item.id)}>{item.text}</button>)}
    </div>
    <div className="guide-answer" aria-live="polite" aria-atomic="true">
      <h3>{questions.find((item) => item.id === question)?.text}</h3>
      {question === "values" && <p>El {scene.acquired_at.slice(0, 10)}, la ventana piloto registra una LST media de{" "}
        <strong>{scene.lst_mean == null ? "sin datos" : `${scene.lst_mean.toFixed(1)} °C`}</strong>{" "}
        y un NDVI medio de <strong>{scene.ndvi_mean == null ? "sin datos" : scene.ndvi_mean.toFixed(3)}</strong>.
        Son medias de píxeles válidos del área piloto. LST representa temperatura superficial, no temperatura del aire.</p>}
      {question === "quality" && <>
        <p>Hay {scene.valid_pixels.toLocaleString("es-BO")} píxeles válidos de {scene.total_pixels.toLocaleString("es-BO")}.
          Las celdas sin valor no se interpretan como cero. Una escena no es un promedio mensual.</p>
        <ul>{evidence.limitations.map((item, index) => <li key={index}>{item}</li>)}</ul>
      </>}
      {question === "interpretation" && <p>Estas adquisiciones permiten describir fechas concretas. Por sí solas no demuestran
        una tendencia climática, significancia estadística ni el efecto de una intervención. Eso requiere una serie
        comparable, tratamiento de estacionalidad, autocorrelación e incertidumbre. PM10 tampoco calibra LST.</p>}
      <p className="caption">Referencia: <code>{scene.id}</code>. Producto: {evidence.product_version}.</p>
      {source && <ExternalLink href={source}>Consultar la fuente de esta adquisición</ExternalLink>}
    </div>
  </Panel>;
}
