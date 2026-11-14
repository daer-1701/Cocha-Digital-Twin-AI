"use client";

import { StatusPanel } from "../components/ui/status-panel";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <StatusPanel
      status="error"
      title="La página falló al mostrarse"
      action={
        <button type="button" onClick={reset}>
          Reintentar
        </button>
      }
    >
      <p>
        Ningún dato se perdió. Si el error se repite, revisa la consola del servidor y
        la respuesta de la API.
      </p>
    </StatusPanel>
  );
}
