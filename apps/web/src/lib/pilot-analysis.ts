import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import type { Evidence } from "./api";

type Result = {
  n: number; slope_per_year: number; ci95: [number, number]; p_value: number;
  p_value_holm: number; significant_at_005_holm: boolean; method: string;
  residual_lag1_correlation: number | null;
  leave_one_year_out_slope_range: [number, number];
};
export type PilotAnalysis = {
  generated_at: string; common_valid_fraction: number; common_pixels: number;
  series: { scene_id: string; year: number; acquired_at: string;
    scene_valid_fraction: number; lst_celsius: number; ndvi: number }[];
  results: { lst_celsius: Result; ndvi: Result }; limitations: string[];
  manifest_sha256: string;
};

export async function getPilotPackage(): Promise<{
  evidence: Evidence; analysis: PilotAnalysis;
} | null> {
  const roots = [path.join(process.cwd(), "public/pilot-analysis"),
    path.join(process.cwd(), "apps/web/public/pilot-analysis")];
  for (const root of roots) {
    let checksums: Record<string, string>;
    try {
      checksums = JSON.parse(await readFile(path.join(root, "checksums.json"), "utf8"));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
      throw new Error("No se pudo validar el paquete científico local.");
    }
    const readVerified = async (name: string) => {
      // Public assets are copied explicitly by the Dockerfile, not traced as server code.
      const bytes = await readFile(/* turbopackIgnore: true */ path.join(/* turbopackIgnore: true */ root, name));
      if (createHash("sha256").update(bytes).digest("hex") !== checksums[name])
        throw new Error("El paquete científico cambió. Vuelve a prepararlo y verificarlo.");
      return bytes.toString("utf8");
    };
    const [analysisText, evidenceText, manifestText] = await Promise.all([
      readVerified("analysis.json"), readVerified("explorer.json"),
      readVerified("manifest.json"), readVerified("series.csv"), readVerified("trends.png"),
    ]);
    const analysis = JSON.parse(analysisText) as PilotAnalysis;
    const evidence = JSON.parse(evidenceText) as Evidence;
    if (createHash("sha256").update(manifestText).digest("hex") !== analysis.manifest_sha256)
      throw new Error("La procedencia del análisis no coincide con su manifiesto.");
    if (analysis.series.length !== 12 || evidence.scenes.length !== 12 ||
        !analysis.series.every((row) => Number.isFinite(row.lst_celsius) &&
          Number.isFinite(row.ndvi) && evidence.scenes.some((s) => s.id === row.scene_id)))
      throw new Error("Paquete científico incompleto.");
    return { analysis, evidence };
  }
  return null;
}
