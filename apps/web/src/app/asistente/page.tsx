import type { Metadata } from "next";
import { PendingSection } from "../../components/pending-section";
import { ExternalLink, safeExternalUrl } from "../../components/ui/external-link";
import { Panel } from "../../components/ui/panel";
import { getAssistantStatus, getEvidence, mergeDemo } from "../../lib/api";
import { EvidenceGuide } from "../../components/evidence-guide";
import { section } from "../../lib/navigation";

const current = section("/asistente");
export const metadata: Metadata = { title: current.title };
export const dynamic = "force-dynamic";

const usd = (value: number) => `USD ${value.toFixed(2)}`;

export default async function Page() {
  const [{ data, demo }, evidence] = await Promise.all([getAssistantStatus(), getEvidence()]);
  const source = safeExternalUrl(data?.prices_source_url);
  return (
    <PendingSection
      section={current}
      demo={mergeDemo(demo, evidence.demo)}
      server={{
        status: data?.status ?? null,
        reason: data?.reason ?? null,
        items: data ? [data.prices_note] : [],
      }}
    >
      {evidence.data && <EvidenceGuide evidence={evidence.data} synthetic={evidence.demo === "active"} />}
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
            <dt>Modelo previsto</dt>
            <dd>
              <code>{data.model}</code>
            </dd>
            <dt>Precios por millón de tokens</dt>
            <dd>
              {data.input_price_usd_per_million_tokens != null &&
              data.output_price_usd_per_million_tokens != null
                ? `${usd(data.input_price_usd_per_million_tokens)} de entrada, ${usd(data.output_price_usd_per_million_tokens)} de salida`
                : "No informados"}
            </dd>
            <dt>Verificación de precios</dt>
            <dd>
              {data.prices_verified ? (
                <>
                  Verificados con la tarifa oficial
                  {data.prices_verified_on && ` el ${data.prices_verified_on}`}
                  {source && (
                    <>
                      {". Fuente: "}
                      <ExternalLink href={source}>{source.hostname}</ExternalLink>
                    </>
                  )}
                  . Las llamadas siguen desactivadas hasta que el servidor las habilite.
                </>
              ) : (
                "Sin verificar con la tarifa oficial; no se hacen llamadas de pago"
              )}
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
