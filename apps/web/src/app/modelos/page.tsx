import type { Metadata } from "next";
import { PendingSection } from "../../components/pending-section";
import { getModels } from "../../lib/api";
import { section } from "../../lib/navigation";

const current = section("/modelos");
export const metadata: Metadata = { title: current.title };
export const dynamic = "force-dynamic";

export default async function Page() {
  const { data, demo } = await getModels();
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
