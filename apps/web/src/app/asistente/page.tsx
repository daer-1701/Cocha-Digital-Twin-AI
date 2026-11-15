import type { Metadata } from "next";
import Link from "next/link";
import { PendingSection } from "../../components/pending-section";
import { ExternalLink, safeExternalUrl } from "../../components/ui/external-link";
import { PageHeader } from "../../components/ui/page-header";
import { Panel } from "../../components/ui/panel";
import { DemoBanner } from "../../components/ui/demo-banner";
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
  const pageDemo = mergeDemo(demo, evidence.demo);
  const live = data?.status === "available" && data.calls_enabled && data.key_configured;

  if (!live) {
    return (
      <PendingSection
        section={current}
        demo={pageDemo}
        server={{
          status: data?.status ?? null,
          reason: data?.reason ?? null,
          items: data ? [data.prices_note] : [],
        }}
      >
        {evidence.data && (
          <EvidenceGuide evidence={evidence.data} synthetic={evidence.demo === "active"} />
        )}
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
              <dt>Clave en el servidor</dt>
              <dd>{data.key_configured ? "Configurada" : "No configurada"}</dd>
            </dl>
          </Panel>
        )}
      </PendingSection>
    );
  }

  return (
    <>
      <DemoBanner state={pageDemo} />
      <PageHeader title={current.title}>
        <p>{current.summary}</p>
      </PageHeader>
      <Panel title="Asistente disponible en el servidor" meta="Gemini habilitado">
        <p>
          Gemini está habilitado con presupuesto limitado. Interpreta un distrito desde el
          mapa (modo «Distritos municipales») o revisa la evidencia piloto publicada abajo.
          Las respuestas deben citar evidencia del servidor; no inventan mediciones.
        </p>
        <p>
          <Link href="/?territorio=distritos">Abrir el mapa en distritos</Link>
          {" · "}
          <Link href="/">Explorador</Link>
        </p>
      </Panel>
      {evidence.data && (
        <EvidenceGuide evidence={evidence.data} synthetic={evidence.demo === "active"} />
      )}
      <Panel title="Estado del presupuesto" meta="Informado por el servidor">
        <dl className="facts">
          <dt>Consultas</dt>
          <dd>Habilitadas</dd>
          <dt>Presupuesto declarado</dt>
          <dd>{usd(data.budget_usd)}</dd>
          <dt>Gastado</dt>
          <dd>{usd(data.spent_usd)}</dd>
          <dt>Reservado</dt>
          <dd>{usd(data.reserved_usd)}</dd>
          <dt>Modelo</dt>
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
                .
              </>
            ) : (
              "Sin verificar con la tarifa oficial"
            )}
          </dd>
          <dt>Clave en el servidor</dt>
          <dd>Configurada</dd>
          <dt>Ledger</dt>
          <dd>{data.ledger === "central_database" ? "Base central" : "Archivo local"}</dd>
        </dl>
        <p className="caption">
          El navegador nunca recibe la clave. Cada consulta reserva y concilia costo en el
          servidor. Presupuesto del proyecto: aproximadamente {usd(data.budget_usd)}.
        </p>
        {data.prices_note && <p className="caption">{data.prices_note}</p>}
      </Panel>
    </>
  );
}
