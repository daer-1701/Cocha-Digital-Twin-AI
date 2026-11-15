"use client";

import { useEffect, useState, type ComponentProps, type ReactNode } from "react";
import type StudyMap from "./study-map";

type StudyMapProps = ComponentProps<typeof StudyMap>;
type StudyMapComponent = (props: StudyMapProps) => ReactNode;

/**
 * Client-only map loader without next/dynamic + React.lazy.
 * Avoids BailoutToCSR / Suspense use() instrumentation issues on React 19.3.
 */
export function StudyMapClient(props: StudyMapProps) {
  const [MapView, setMapView] = useState<StudyMapComponent | null>(null);

  useEffect(() => {
    let cancelled = false;
    void import("./study-map").then((mod) => {
      if (!cancelled) setMapView(() => mod.default);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!MapView) {
    return (
      <div className="map-placeholder" role="status">
        Cargando el valle…
      </div>
    );
  }

  return <MapView {...props} />;
}
