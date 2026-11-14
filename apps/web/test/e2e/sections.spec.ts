import { expect, test } from "@playwright/test";
import { expectDemo, FIXTURES_URL, useScenario } from "./helpers";

test("comparación demo: los 15 rectángulos usan la fecha elegida", async ({ page, request }) => {
  await useScenario("valle");
  await page.goto("/comparar");
  await expectDemo(page);
  const selector = page.getByLabel("Fecha de la comparación de prueba");
  const options = selector.locator("option");
  const oldest = await options.first().getAttribute("value");
  const newest = await options.last().getAttribute("value");
  expect(oldest).toBeTruthy();
  expect(newest).not.toBe(oldest);
  await expect(selector).toHaveValue(newest!);
  const board = page.locator(".district-board");
  await expect(board.locator("tbody tr")).toHaveCount(15);
  await expect(board).toContainText(newest!);
  await selector.selectOption(oldest!);
  await page.getByRole("button", { name: "Ver fecha", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`scene_id=${encodeURIComponent(oldest!)}`));
  await expect(selector).toHaveValue(oldest!);
  await expect(board.locator("tbody tr")).toHaveCount(15);
  await expect(board).toContainText(oldest!);
  const response = await request.get(
    `${FIXTURES_URL}/v1/indicators?limit=100&scene_id=${encodeURIComponent(oldest!)}`,
  );
  const body = await response.json();
  expect(body.selected_scene_id).toBe(oldest);
  expect(body.items).toHaveLength(30);
  const item = body.items.find(
    (item: { district_number: number; variable: string }) =>
      item.district_number === 1 && item.variable === "lst_celsius",
  );
  const row = board.getByRole("row").filter({ hasText: item.district_name });
  await expect(row.locator("td").first()).toContainText(item.value.toFixed(1));
});

test.describe("secciones sin resultados del servidor", () => {
  test.beforeEach(() => useScenario("available"));

  test("estimaciones: sin valores de ejemplo y con bloqueos", async ({ page }) => {
    await page.goto("/modelos");
    await expectDemo(page);
    await expect(page.getByRole("heading", { name: "Esta sección todavía no tiene resultados" })).toBeVisible();
    await expect(page.getByText("No se muestran valores de ejemplo mientras tanto.")).toBeVisible();
    await expect(page.getByText("Estimación").first()).toBeVisible();
  });

  test("escenarios: rotulados como simulación hipotética", async ({ page }) => {
    await page.goto("/escenarios");
    await expect(page.getByText("Simulación").first()).toBeVisible();
    await expect(page.getByText("Escenario hipotético, no una predicción ni una medición").first()).toBeVisible();
    await expect(page.getByText("No se muestran valores de ejemplo mientras tanto.")).toBeVisible();
  });

  test("comparar distritos: pendiente de vectores oficiales", async ({ page }) => {
    await page.goto("/comparar");
    await expect(page.getByText(/Límites oficiales de los 15 distritos/)).toBeVisible();
  });
});

test.describe("asistente", () => {
  test("sin cuota: llamadas desactivadas y precios sin verificar", async ({ page }) => {
    await useScenario("available");
    await page.goto("/asistente");
    const budget = page.locator(".facts");
    await expect(budget).toContainText("Desactivadas");
    await expect(budget).toContainText("USD 4.00");
    await expect(budget).toContainText("Sin verificar con la tarifa oficial");
    await expect(budget).toContainText("No configurada");
  });

  test("precios verificados muestran fecha y fuente externa", async ({ page }) => {
    await useScenario("wms");
    await page.goto("/asistente");
    const budget = page.locator(".facts");
    await expect(budget).toContainText("Verificados con la tarifa oficial el 2026-01-01");
    await expect(budget).toContainText("Las llamadas siguen desactivadas");
    const source = budget.getByRole("link", { name: /example\.org/ });
    await expect(source).toHaveAttribute("target", "_blank");
    await expect(source).toHaveAttribute("rel", /noopener/);
  });
});

test.describe("estaciones MÓNICA", () => {
  test("ficha con ubicación descrita, unidad y metadatos pendientes en español", async ({
    page,
  }) => {
    await useScenario("available");
    await page.goto("/estaciones");
    await expectDemo(page);
    await expect(page.getByText("no sirve para calibrar ni validar la temperatura superficial")).toBeVisible();
    const card = page.locator(".card-grid .panel").first();
    await expect(card).toContainText("Ubicación descrita sintética A");
    await expect(card).toContainText("µg/m³");
    await expect(card).toContainText("Zona horaria de la fecha de medición");
    await expect(card).toContainText("Coordenadas de la estación (el CSV no trae latitud ni longitud)");
    await expect(card).toContainText("no se dibuja en el mapa");
    await expect(card.getByRole("link", { name: /Informe de referencia/ })).toHaveAttribute(
      "target",
      "_blank",
    );
  });
});
