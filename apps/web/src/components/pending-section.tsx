import Link from "next/link";
import type { Section } from "../lib/navigation";
import { NatureBadge } from "./ui/nature-badge";
import { PageHeader } from "./ui/page-header";
import { StatusPanel } from "./ui/status-panel";

/** Honest placeholder: states what is missing instead of showing sample results. */
export function PendingSection({ section }: { section: Section }) {
  return (
    <>
      <PageHeader title={section.title}>
        <p>{section.summary}</p>
        {section.nature && <NatureBadge nature={section.nature} detailed />}
      </PageHeader>
      <StatusPanel
        status="pending"
        title="Esta sección todavía no tiene resultados"
        action={<Link href="/">Ir al explorador</Link>}
      >
        <p>Para mostrar resultados reales hace falta:</p>
        <ul>
          {section.requires?.map((item) => <li key={item}>{item}</li>)}
        </ul>
        <p>No se muestran valores de ejemplo mientras tanto.</p>
      </StatusPanel>
    </>
  );
}
