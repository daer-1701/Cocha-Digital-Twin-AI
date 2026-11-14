import type { Metadata } from "next";
import { DistrictBoard } from "../../components/district-board";
import { PendingSection } from "../../components/pending-section";
import { getIndicators, getTrends, mergeDemo } from "../../lib/api";
import { section } from "../../lib/navigation";

const current = section("/comparar");
export const metadata: Metadata = { title: current.title };
export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ scene_id?: string }>;
}) {
  const { scene_id: sceneId } = await searchParams;
  const [indicators, trends] = await Promise.all([getIndicators(sceneId), getTrends()]);
  const selectedSceneId = indicators.data?.selected_scene_id ?? null;
  const scenes = indicators.data?.pilot_window?.scenes ?? [];
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
      {selectedSceneId && scenes.length > 0 && (
        <form action="/comparar">
          <label htmlFor="comparison-scene">Fecha de la comparación de prueba</label>{" "}
          <select id="comparison-scene" name="scene_id" defaultValue={selectedSceneId}>
            {scenes.map((scene) => (
              <option key={scene.scene_id} value={scene.scene_id}>
                {scene.acquired_at?.slice(0, 10) ?? scene.scene_id}
              </option>
            ))}
          </select>{" "}
          <button type="submit">Ver fecha</button>
          <p>Por defecto se muestra la adquisición más reciente disponible.</p>
        </form>
      )}
      <DistrictBoard
        indicators={demoItems}
        trends={trends.data?.demo_trends ?? []}
        sceneId={selectedSceneId}
      />
    </PendingSection>
  );
}
