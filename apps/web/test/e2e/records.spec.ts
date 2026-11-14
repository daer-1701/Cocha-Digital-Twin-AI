import { expect, test } from "@playwright/test";
import { expectDemo, useScenario } from "./helpers";

const KANATA = "00000000-0000-4000-8000-000000005a01";
const SEMAPA = "00000000-0000-4000-8000-000000005a02";

test.describe("procesamiento", () => {
  test("historial paginado con estados traducidos y tipos desconocidos literales", async ({
    page,
  }) => {
    await useScenario("monica-review");
    await page.goto("/procesamiento");
    await expectDemo(page);
    const table = page.getByRole("table", { name: /Ejecuciones recientes/ });
    await expect(table.locator("tbody tr")).toHaveCount(20);
    const first = table.locator("tbody tr").first();
    await expect(first).toContainText("Importación MÓNICA");
    await expect(first).toContainText("En ejecución");
    await expect(first.locator("td").nth(2)).toHaveText("Sin registrar");
    await expect(table.locator("tbody tr").nth(1)).toContainText("Fallido");
    await expect(table).toContainText("Revisión de calidad MÓNICA");
    await expect(table).toContainText("fixture_unknown_kind");

    const pages = page.getByRole("navigation", { name: "Páginas de ejecuciones" });
    await expect(pages.getByRole("link", { name: "Más recientes" })).toHaveCount(0);
    await pages.getByRole("link", { name: "Anteriores" }).click();
    await expect(page).toHaveURL(/offset=20/);
    await expect(table.locator("tbody tr")).toHaveCount(5);
    await expect(pages.getByRole("link", { name: "Anteriores" })).toHaveCount(0);
    await expect(pages.getByRole("link", { name: "Más recientes" })).toBeVisible();
  });

  test("sin ejecuciones registradas: estado vacío", async ({ page }) => {
    await useScenario("available");
    await page.goto("/procesamiento");
    await expect(page.getByRole("heading", { name: "No hay ejecuciones en esta página" })).toBeVisible();
  });

  test("un offset inválido en el enlace vuelve a la primera página", async ({ page }) => {
    await useScenario("monica-review");
    await page.goto("/procesamiento?offset=-5");
    await expect(page.getByRole("table", { name: /Ejecuciones recientes/ }).locator("tbody tr")).toHaveCount(20);
  });
});

test.describe("revisión de registros MÓNICA", () => {
  test("la ficha enlaza a los registros; ceros, negativos y faltantes se conservan", async ({
    page,
  }) => {
    await useScenario("monica-review");
    await page.goto("/estaciones");
    await page
      .locator(".card-grid .panel")
      .filter({ hasText: "DEMO Kanata" })
      .getByRole("link", { name: "Revisar registros importados y calidad" })
      .click();
    await expect(page).toHaveURL(new RegExp(`/estaciones/${KANATA}$`));
    await expectDemo(page);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Registros de DEMO Kanata");
    await expect(page.getByText("sin conversión de zona horaria")).toBeVisible();

    const table = page.getByRole("table", { name: /PM10 importado/ });
    const rows = table.locator("tbody tr");
    await expect(rows).toHaveCount(50);
    await expect(rows.first().locator("th")).toHaveText("2026-10-03 23:00:00");
    await expect(table).toContainText("µg/m³");
    const missing = rows.filter({ hasText: "Valor inválido" }).first();
    await expect(missing.locator("td").first()).toHaveText("Sin datos");
    const zero = rows.filter({ hasText: "Cero: requiere revisión" }).first();
    await expect(zero.locator("td").first()).toHaveText("0");
    const negative = rows.filter({ hasText: "Negativo: requiere revisión" }).first();
    await expect(negative.locator("td").first()).toHaveText("-2,5");
    await expect(table).toContainText("Aceptado por el parser; sin validación instrumental");

    const pages = page.getByRole("navigation", { name: "Páginas de registros" });
    await pages.getByRole("link", { name: "Anteriores" }).click();
    await expect(page).toHaveURL(/offset=50/);
    await expect(rows).toHaveCount(10);
    await expect(rows.last()).toContainText("Sin referencia");
    await expect(pages.getByRole("link", { name: "Anteriores" })).toHaveCount(0);
  });

  test("estación importada sin filas: estado vacío", async ({ page }) => {
    await useScenario("monica-review");
    await page.goto(`/estaciones/${SEMAPA}`);
    await expect(page.getByRole("heading", { name: "No hay registros en esta página" })).toBeVisible();
  });

  test("revisión desactivada en el servidor: no muestra registros", async ({ page }) => {
    await useScenario("monica-locked");
    await page.goto(`/estaciones/${KANATA}`);
    await expect(page.getByRole("heading", { name: "Revisión de registros desactivada" })).toBeVisible();
    await expect(page.getByRole("table")).toHaveCount(0);
  });

  test("estación inexistente: error recuperable; identificador malformado: página inexistente", async ({
    page,
  }) => {
    await useScenario("monica-review");
    await page.goto("/estaciones/00000000-0000-4000-8000-0000000fffff");
    await expect(
      page.getByRole("heading", { name: "Estación ausente o servicio no disponible" }),
    ).toBeVisible();
    await page.goto("/estaciones/no-es-un-uuid");
    await expect(page.getByRole("heading", { name: "Esta página no existe" })).toBeVisible();
  });

  test.fixme("QA-07: un identificador malformado responde HTTP 404", async ({ page }) => {
    const response = await page.goto("/estaciones/no-es-un-uuid");
    expect(response?.status()).toBe(404);
  });

  test("sin estaciones importadas, las fichas no enlazan a registros", async ({ page }) => {
    await useScenario("available");
    await page.goto("/estaciones");
    await expect(page.getByRole("link", { name: "Revisar registros importados y calidad" })).toHaveCount(0);
  });
});
