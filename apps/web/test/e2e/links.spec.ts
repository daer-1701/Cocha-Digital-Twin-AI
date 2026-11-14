import { expect, test, type Page } from "@playwright/test";
import { useScenario } from "./helpers";

/** Data rows of the CSV, keyed by scene id, without the `#` metadata header. */
function csvRows(text: string): Map<string, string[]> {
  const lines = text.replace(/^\uFEFF/, "").split("\r\n");
  const header = lines.find((line) => line.startsWith("scene_id,"));
  expect(header, "cabecera de columnas del CSV").toBeTruthy();
  return new Map(
    lines
      .filter((line) => line.startsWith("DEMO-"))
      .map((line) => {
        const cells = line.split(",");
        return [cells[0], cells];
      }),
  );
}

async function previewRows(page: Page) {
  return page
    .getByRole("table", { name: /Resumen de las escenas/ })
    .locator("tbody tr")
    .evaluateAll((rows) =>
      rows.map((row) => [...row.querySelectorAll("td")].map((cell) => cell.textContent?.trim() ?? "")),
    );
}

const shown = (value: string, digits: number) => (value === "" ? "Sin datos" : Number(value).toFixed(digits));

test.describe("informes coinciden con la pantalla", () => {
  test("vista previa, CSV y JSON publican los mismos valores, con faltantes vacíos", async ({
    page,
    request,
  }) => {
    await useScenario("partial");
    await page.goto("/informes");
    const preview = await previewRows(page);
    const csvHref = await page.getByRole("link", { name: "Descargar CSV" }).getAttribute("href");
    const csv = csvRows(await (await request.get(csvHref!)).text());
    const jsonHref = await page.getByRole("link", { name: "Descargar JSON" }).getAttribute("href");
    const json = await (await request.get(jsonHref!)).json();

    expect(preview).toHaveLength(csv.size);
    expect(json.evidence.scenes).toHaveLength(csv.size);
    for (const scene of json.evidence.scenes) {
      const row = csv.get(scene.id)!;
      expect(row, scene.id).toBeTruthy();
      const [, acquired, platform, lst, ndvi, valid] = row;
      expect(acquired).toBe(scene.acquired_at);
      expect(platform).toBe(scene.platform);
      expect(lst).toBe(scene.lst_mean == null ? "" : String(scene.lst_mean));
      expect(ndvi).toBe(scene.ndvi_mean == null ? "" : String(scene.ndvi_mean));
      const screen = preview.find((cells) => cells[0] === scene.acquired_at.slice(0, 10))!;
      expect(screen, scene.id).toBeTruthy();
      expect(screen[2]).toBe(shown(lst, 2));
      expect(screen[3]).toBe(shown(ndvi, 3));
      expect(screen[4]).toBe(`${(Number(valid) * 100).toFixed(1)} %`);
    }
    // The 2024 scene has no valid pixels: empty in CSV, null in JSON, «Sin datos» on screen.
    expect(csv.get("DEMO-SINTETICA-2024-07")![3]).toBe("");
    expect(json.evidence.scenes.at(-1).lst_mean).toBeNull();
  });

  test("el explorador y la vista previa muestran la misma media de la escena", async ({ page }) => {
    await useScenario("available");
    await page.goto("/?escena=DEMO-SINTETICA-2023-07");
    const explorerRow = page
      .getByRole("table", { name: /Comparación descriptiva/ })
      .locator('tr[aria-current="true"] td');
    const explorerLst = await explorerRow.nth(1).innerText();
    await page.getByRole("link", { name: "Descargar los datos de esta fecha" }).click();
    await expect(page).toHaveURL(/contenido=escenas&escena=DEMO-SINTETICA-2023-07/);
    const preview = await previewRows(page);
    expect(preview).toHaveLength(1);
    expect(preview[0][0]).toBe("2023-07-15");
    expect(preview[0][2]).toBe(explorerLst);
  });

  test("una selección inválida en el enlace exporta todo el resumen", async ({ page, request }) => {
    await useScenario("available");
    await page.goto("/informes?contenido=otra&escena=NO-EXISTE");
    await expect(page.getByLabel("Contenido")).toHaveValue("escenas");
    await expect(page.getByLabel("Escena")).toHaveValue("");
    const href = await page.getByRole("link", { name: "Descargar CSV" }).getAttribute("href");
    expect(csvRows(await (await request.get(href!)).text()).size).toBe(3);
  });

  test("las celdas de texto no se exportan como fórmulas", async ({ request }) => {
    await useScenario("available");
    const text = await (await request.get("/api/informes/csv?contenido=escenas")).text();
    const cells = [...csvRows(text).values()].flat();
    expect(cells.some((cell) => /^[=+@]/.test(cell))).toBe(false);
  });
});

test.describe("enlaces compartidos", () => {
  test("el enlace copiado reproduce fecha, comparación y variable en otra pestaña", async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await useScenario("available");
    await page.goto("/");
    await page.getByLabel("Fecha de adquisición").selectOption("DEMO-SINTETICA-2022-07");
    await page.getByLabel("Comparar con").selectOption("DEMO-SINTETICA-2024-07");
    await page.getByLabel("Variable", { exact: true }).selectOption("ndvi");
    await page.getByRole("button", { name: "Copiar enlace a esta vista" }).click();
    await expect(page.getByText("Enlace copiado.")).toBeVisible();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toContain("escena=DEMO-SINTETICA-2022-07");

    const other = await context.newPage();
    await other.goto(copied);
    await expect(other.getByLabel("Fecha de adquisición")).toHaveValue("DEMO-SINTETICA-2022-07");
    await expect(other.getByLabel("Comparar con")).toHaveValue("DEMO-SINTETICA-2024-07");
    await expect(other.getByLabel("Variable", { exact: true })).toHaveValue("ndvi");
    await expect(other.locator(".link-notice")).toHaveCount(0);
  });

  test("sin portapapeles, el botón explica cómo compartir", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText: () => Promise.reject(new Error("denied")) },
      });
    });
    await useScenario("available");
    await page.goto("/");
    await page.getByRole("button", { name: "Copiar enlace a esta vista" }).click();
    await expect(page.getByText(/No se pudo copiar/)).toBeVisible();
  });
});
