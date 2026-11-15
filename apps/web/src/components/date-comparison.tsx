"use client";

import { useState } from "react";
import type { Evidence } from "../lib/api";
import { ComparisonPanel } from "./comparison-panel";

export function DateComparison({ scenes }: { scenes: Evidence["scenes"] }) {
  const ordered = [...scenes].sort((a, b) => a.acquired_at.localeCompare(b.acquired_at));
  const [firstId, setFirstId] = useState(ordered[0]?.id ?? "");
  const [secondId, setSecondId] = useState(ordered.at(-1)?.id ?? "");
  if (ordered.length < 2) return null;
  const first = ordered.find((scene) => scene.id === firstId) ?? ordered[0];
  const second = ordered.find((scene) => scene.id === secondId) ?? ordered[ordered.length - 1];
  return <ComparisonPanel first={first} second={second} controls={
    <div className="date-comparison-controls">
      <label>Primera fecha
        <select value={first.id} onChange={(event) => setFirstId(event.target.value)}>
          {ordered.map((scene) => <option key={scene.id} value={scene.id} disabled={scene.id === second.id}>{scene.acquired_at.slice(0, 10)}</option>)}
        </select>
      </label>
      <label>Segunda fecha
        <select value={second.id} onChange={(event) => setSecondId(event.target.value)}>
          {ordered.map((scene) => <option key={scene.id} value={scene.id} disabled={scene.id === first.id}>{scene.acquired_at.slice(0, 10)}</option>)}
        </select>
      </label>
      <p>Compará las adquisiciones disponibles. Las columnas se ordenan de la más antigua a la más reciente.</p>
    </div>
  } />;
}
