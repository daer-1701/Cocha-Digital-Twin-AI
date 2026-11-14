"use client";

import { useEffect, useState } from "react";
import type { Evidence } from "../lib/api";

export function SceneTimeline({ scenes, selectedId, onSelect }: {
  scenes: Evidence["scenes"];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const [playing, setPlaying] = useState(false);
  const ordered = [...scenes].sort((a, b) => a.acquired_at.localeCompare(b.acquired_at));
  const index = Math.max(0, ordered.findIndex((scene) => scene.id === selectedId));
  useEffect(() => {
    if (!playing || ordered.length < 2) return;
    const stopWhenHidden = () => { if (document.hidden) setPlaying(false); };
    document.addEventListener("visibilitychange", stopWhenHidden);
    const timer = window.setTimeout(() => {
      if (index === ordered.length - 1) setPlaying(false);
      else onSelect(ordered[index + 1].id);
    }, 2600);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", stopWhenHidden);
    };
  }, [playing, index, ordered, onSelect]);
  if (!ordered.length) return null;
  return (
    <section className="scene-timeline" aria-label="Recorrido temporal">
      <div className="timeline-intro">
        <div><strong>Un valle, distintas fechas</strong><p>Cada paso es una adquisición. Los intervalos entre fechas pueden variar.</p></div>
        <button type="button" className="timeline-play" disabled={ordered.length < 2}
          aria-pressed={playing} onClick={() => {
            if (!playing && index === ordered.length - 1) onSelect(ordered[0].id);
            setPlaying(!playing);
          }}>{playing ? "Pausar recorrido" : "Reproducir fechas"}</button>
      </div>
      <label className="sr-only" htmlFor="time-scrubber">Adquisición mostrada</label>
      <input id="time-scrubber" type="range" min={0} max={Math.max(0, ordered.length - 1)}
        value={index} disabled={ordered.length < 2}
        aria-valuetext={ordered[index].acquired_at.slice(0, 10)}
        onChange={(event) => { setPlaying(false); onSelect(ordered[Number(event.target.value)].id); }} />
      <div className="timeline-dates">
        {ordered.map((scene) => (
          <button key={scene.id} type="button" aria-pressed={scene.id === selectedId}
            onClick={() => { setPlaying(false); onSelect(scene.id); }}>
            <time dateTime={scene.acquired_at}>{scene.acquired_at.slice(0, 10)}</time>
            <span>{Math.round(scene.valid_fraction * 100)} % válido</span>
          </button>
        ))}
      </div>
    </section>
  );
}
