import type { Metadata } from "next";
import { DistrictBoard } from "../../components/district-board";
import { PendingSection } from "../../components/pending-section";
import { getIndicators, getTrends, mergeDemo } from "../../lib/api";
import { section } from "../../lib/navigation";

const current = section("/comparar");
export const metadata: Metadata = { title: current.title };
export const dynamic = "force-dynamic";

export default async function Page() {
  const [indicators, trends] = await Promise.all([getIndicators(), getTrends()]);
  const reasons = [indicators.data?.reason, trends.data?.reason].filter(
    (reason): reason is string => Boolean(reason),
  );
  const demoItems = (indicators.data?.items ?? []).filter(
    (item) => item.nature === "demo_synthetic",
  );
  return (
    <PendingSection
      section={current}
      demo={mergeDemo(indicators.demo, trends.demo)}
      preview={demoItems.length > 0}
      server={{
        // District comparison needs both resources; report the least available one.
        status:
          indicators.data && trends.data
            ? indicators.data.status === "available" && trends.data.status === "available"
              ? "available"
              : "unavailable"
            : null,
        items: reasons,
      }}
    >
      <DistrictBoard indicators={demoItems} trends={trends.data?.demo_trends ?? []} />
    </PendingSection>
  );
}
