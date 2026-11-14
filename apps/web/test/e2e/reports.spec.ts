import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { expectDemo, useScenario } from "./helpers";

test.describe("informes y descargas", () => {
  test("vista previa con metadatos y descargas rotuladas como demo", async ({ page }) => {
    await useScenario("available");
    await page.goto("/informes");
    await expectDemo(page);
    await expect(page.getByText("No es un informe por distrito")).toBeVisible();
    await expect(page.getByText("2022-07-15 a 2024-07-15, 3 escenas")).toBeVisible();
    await expect(page.getByRole("table", { name: /Resumen de las escenas/ }).getByRole("row")).toHaveCount(4);

    const download = page.waitForEvent("download");
    await page.getByRole("link", { name: "Descargar CSV" }).click();
    const csv = await download;
    expect(csv.suggestedFilename()).toMatch(/^DEMO-SINTETICO_.*escenas\.csv$/);
    const text = await readFile(await csv.path(), "utf8");
    expect(text).toContain("# DEMO: datos sintéticos de prueba");
    expect(text).toContain("no es un informe distrital");
    expect(text).toContain("scene_id,acquired_at,platform,lst_mean_c");
    expect(text.match(/^DEMO-SINTETICA-/gm)).toHaveLength(3);
  });

  test("la selección de escena y celdas viaja a la descarga; faltantes quedan vacíos", async ({
    page,
    request,
  }) => {
    await useScenario("partial");
    await page.goto("/informes");
    await page.getByLabel("Contenido").selectOption("celdas");
    await page.getByLabel("Escena").selectOption("DEMO-SINTETICA-2023-07");
    await page.getByRole("button", { name: "Actualizar vista previa" }).click();
    await expect(page).toHaveURL(/contenido=celdas&escena=DEMO-SINTETICA-2023-07/);
    await expect(page.getByText(/36 celdas de la escena del 2023-07-15/)).toBeVisible();

    const href = await page.getByRole("link", { name: "Descargar CSV" }).getAttribute("href");
    const response = await request.get(href!);
    expect(response.headers()["content-disposition"]).toContain("celdas_DEMO-SINTETICA-2023-07.csv");
    const rows = (await response.text()).split("\r\n").filter((l) => l.startsWith("DEMO-"));
    expect(rows).toHaveLength(36);
    expect(rows.some((r) => r.endsWith(",,"))).toBe(true);
    expect(rows.some((r) => /,0,0$/.test(r))).toBe(false);
  });

  test("JSON conserva el contrato y marca los datos sintéticos", async ({ request }) => {
    await useScenario("available");
    const response = await request.get("/api/informes/json?contenido=escenas");
    expect(response.ok()).toBe(true);
    const body = await response.json();
    expect(body.download.synthetic_fixture).toBe(true);
    expect(body.scope).toBe("pilot_window");
    expect(body.district_report).toBe(false);
    expect(body.evidence.scenes).toHaveLength(3);
    expect(body.evidence.scenes[0].cells).toBeUndefined();
  });

  test("sin snapshot: estado vacío y descarga rechazada", async ({ page, request }) => {
    await useScenario("empty");
    await page.goto("/informes");
    await expect(page.getByRole("heading", { name: "No hay observaciones para exportar" })).toBeVisible();
    expect((await request.get("/api/informes/csv")).status()).toBe(404);
    expect((await request.get("/api/informes/xml")).status()).toBe(404);
  });
});
