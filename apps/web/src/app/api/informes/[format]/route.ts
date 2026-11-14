import { getReports } from "../../../../lib/api";
import { buildCsv, buildJson, parseSelection, reportFilename } from "../../../../lib/report";

export const dynamic = "force-dynamic";

const fail = (status: number, reason: string) =>
  Response.json({ status: "unavailable", reason }, { status });

export async function GET(
  request: Request,
  { params }: { params: Promise<{ format: string }> },
) {
  const { format } = await params;
  if (format !== "json" && format !== "csv") return fail(404, "Formato no soportado");
  const { data, error, demo } = await getReports();
  if (demo === "blocked")
    return fail(503, "Datos sintéticos bloqueados en una compilación de producción");
  if (error || !data) return fail(502, "La API no devolvió el informe");
  const exported = data.observation_export;
  if (!exported) return fail(404, "No hay observaciones publicadas para exportar");

  const synthetic = demo === "active";
  const selection = parseSelection(new URL(request.url).searchParams, exported);
  const now = new Date();
  const body =
    format === "csv"
      ? `\uFEFF${buildCsv(exported, selection, synthetic, now)}\r\n`
      : JSON.stringify(buildJson(exported, selection, synthetic, now), null, 2);
  return new Response(body, {
    headers: {
      "content-type":
        format === "csv" ? "text/csv; charset=utf-8" : "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="${reportFilename(format, selection, synthetic)}"`,
      "cache-control": "no-store",
      ...(synthetic ? { "x-cocha-data-source": "synthetic-fixture" } : {}),
    },
  });
}
