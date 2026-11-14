import Link from "next/link";
import type { ReactNode } from "react";
import type { DemoState } from "../lib/api";
import type { Section } from "../lib/navigation";
import { DemoBanner } from "./ui/demo-banner";
import { NatureBadge } from "./ui/nature-badge";
import { PageHeader } from "./ui/page-header";
import { ServerDetail } from "./ui/server-detail";
import { StatusPanel } from "./ui/status-panel";

export type ServerState = {
  /** null when the API could not be reached or answered with an invalid shape. */
  status: "available" | "empty" | "unavailable" | null;
  reason?: string | null;
  items?: string[];
};

const SERVER_TEXT = {
  unavailable: "El servidor confirma que estos resultados todavía no están disponibles.",
  empty: "El servidor responde, pero todavía no tiene registros para esta sección.",
  available: "El servidor tiene registros, pero esta vista todavía no los muestra.",
};

/** Honest placeholder: states what is missing instead of showing sample results. */
export function PendingSection({
  section,
  demo = "off",
  server,
  children,
}: {
  section: Section;
  demo?: DemoState;
  server?: ServerState;
  children?: ReactNode;
}) {
  return (
    <>
      <DemoBanner state={demo} />
      <PageHeader title={section.title}>
        <p>{section.summary}</p>
        {section.nature && <NatureBadge nature={section.nature} detailed />}
      </PageHeader>
      <StatusPanel
        status="pending"
        title="Esta sección todavía no tiene resultados"
        action={<Link href="/">Ir al explorador</Link>}
      >
        {server && (
          <p>
            {server.status
              ? SERVER_TEXT[server.status]
              : "No se pudo consultar el estado de esta sección en el servidor."}
          </p>
        )}
        <p>Para mostrar resultados reales hace falta:</p>
        <ul>
          {section.requires?.map((item) => <li key={item}>{item}</li>)}
        </ul>
        <p>No se muestran valores de ejemplo mientras tanto.</p>
        {server && <ServerDetail reason={server.reason} items={server.items} />}
      </StatusPanel>
      {children}
    </>
  );
}
