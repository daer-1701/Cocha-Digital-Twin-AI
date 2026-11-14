import type { Metadata } from "next";
import { PendingSection } from "../../components/pending-section";
import { getScenarios } from "../../lib/api";
import { section } from "../../lib/navigation";

const current = section("/escenarios");
export const metadata: Metadata = { title: current.title };
export const dynamic = "force-dynamic";

export default async function Page() {
  const { data, demo } = await getScenarios();
  return (
    <PendingSection
      section={current}
      demo={demo}
      server={{
        status: data?.status ?? null,
        reason: data?.reason ?? null,
        items: data?.blockers ?? [],
      }}
    />
  );
}
