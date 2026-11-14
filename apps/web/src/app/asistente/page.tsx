import type { Metadata } from "next";
import { PendingSection } from "../../components/pending-section";
import { Panel } from "../../components/ui/panel";
import { getAssistantStatus } from "../../lib/api";
import { section } from "../../lib/navigation";

const current = section("/asistente");
export const metadata: Metadata = { title: current.title };
export const dynamic = "force-dynamic";

const usd = (value: number) => `USD ${value.toFixed(2)}`;

export default async function Page() {
  const { data, demo } = await getAssistantStatus();
  return (
    <PendingSection
      section={current}
      demo={demo}
      server={{
        status: data?.status ?? null,
        reason: data?.reason ?? null,
        items: data ? [data.prices_note] : [],
      }}
    >
      {data && (
        <Panel title="Estado del presupuesto" meta="Informado por el servidor">
          <dl className="facts">
            <dt>Consultas</dt>
            <dd>{data.calls_enabled ? "Habilitadas" : "Desactivadas"}</dd>
            <dt>Presupuesto declarado</dt>
            <dd>{usd(data.budget_usd)}</dd>
            <dt>Gastado</dt>
            <dd>{usd(data.spent_usd)}</dd>
            <dt>Reservado</dt>
            <dd>{usd(data.reserved_usd)}</dd>
            <dt>Precios por token</dt>
            <dd>
              {data.prices_verified
                ? "Verificados"
                : "Sin verificar con la tarifa oficial; no se hacen llamadas de pago"}
            </dd>
            <dt>Clave en el servidor</dt>
            <dd>{data.key_configured ? "Configurada" : "No configurada"}</dd>
          </dl>
          <p className="caption">
            El navegador nunca recibe la clave. Cuando se habilite, el asistente solo
            responderá con evidencia publicada y citará su fuente.
          </p>
        </Panel>
      )}
    </PendingSection>
  );
}
