import type { Metadata } from "next";
import { PendingSection } from "../../components/pending-section";
import { DemoBanner } from "../../components/ui/demo-banner";
import { NatureBadge } from "../../components/ui/nature-badge";
import { PageHeader } from "../../components/ui/page-header";
import { getModels } from "../../lib/api";
import { section } from "../../lib/navigation";

const current = section("/modelos");
export const metadata: Metadata = { title: current.title };
export const dynamic = "force-dynamic";

export default async function Page() {
  const { data, demo } = await getModels();
  if (data?.accepted_models?.length) {
    return (
      <>
        <DemoBanner state={demo} />
        <PageHeader title="Modelos aceptados">
          <p>Estimaciones con validación y dominio de uso declarados.</p>
          <NatureBadge nature="estimated" detailed />
        </PageHeader>
        {data.accepted_models.map((model) => (
          <article key={model.id} className="panel">
            <h2>{model.objective}</h2>
            <dl>
              <dt>Versión</dt><dd>{model.model_version}</dd>
              <dt>Validación</dt><dd>{model.validation_partition ?? "No declarada"}</dd>
            </dl>
            <details>
              <summary>Métricas, incertidumbre y dominio publicados</summary>
              <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                {JSON.stringify({
                  metrics: model.metrics,
                  uncertainty: model.uncertainty,
                  domain: model.domain_of_use,
                }, null, 2)}
              </pre>
            </details>
          </article>
        ))}
      </>
    );
  }
  return (
    <PendingSection
      section={current}
      demo={demo}
      server={{
        status: data?.status ?? null,
        reason: data?.reason ?? null,
        items: [...(data?.viability_note ? [data.viability_note] : []), ...(data?.blockers ?? [])],
      }}
    />
  );
}
