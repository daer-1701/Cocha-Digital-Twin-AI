import { expect, test, type Page } from "@playwright/test";
import { FIXTURES_URL, useScenario } from "./helpers";

// External basemap and relief tiles are blocked: tests stay deterministic and do not load OSM servers.
const EXTERNAL_TILES =
  /tile\.openstreetmap\.org|elevation-tiles-prod|server\.arcgisonline\.com/;

test.beforeEach(() => useScenario("available"));

async function openExplorer(page: Page) {
  await page.route(EXTERNAL_TILES, (route) => route.abort());
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Centrar" })).toBeEnabled({ timeout: 20_000 });
  await page.getByRole("button", { name: "2D", exact: true }).click();
}

const orbitButton = (page: Page) => page.getByRole("group", { name: "Relieve", exact: true }).getByRole("button");
const canvas = (page: Page) => page.locator("canvas.maplibregl-canvas");

test.describe("interacción 3D del explorador", () => {
  test("el fondo satelital conserva fecha y variable y explica su alcance", async ({ page }) => {
    await openExplorer(page);
    const date = await page.locator("#scene").inputValue();
    await page.getByRole("button", { name: "Satélite", exact: true }).click();
    await expect(page.getByRole("button", { name: "Satélite", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".basemap-note")).toContainText("fecha puede diferir");
    await expect(page.locator("#scene")).toHaveValue(date);
    await page.getByRole("button", { name: "Calles", exact: true }).click();
    await expect(page.getByRole("button", { name: "Calles", exact: true })).toHaveAttribute("aria-pressed", "true");
  });
  test("con movimiento reducido arranca en 2D y no ofrece giro", async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: "reduce" });
    const page = await context.newPage();
    await openExplorer(page);
    await expect(page.getByRole("button", { name: "2D", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("button", { name: "Girar" })).toBeDisabled();
    await context.close();
  });

  test("el giro es optativo y se detiene al tocar el mapa", async ({ page }) => {
    await openExplorer(page);
    await expect(page.getByRole("button", { name: "2D", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(orbitButton(page)).toHaveText("Girar");
    await page.getByRole("button", { name: "3D", exact: true }).click();
    await orbitButton(page).click();
    await expect(orbitButton(page)).toHaveText("Detener giro");
    await expect(orbitButton(page)).toHaveAttribute("aria-pressed", "true");
    await canvas(page).scrollIntoViewIfNeeded();
    const box = (await canvas(page).boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.up();
    await expect(orbitButton(page)).toHaveText("Girar");
  });

  test("el giro se detiene con el teclado sobre el mapa y al pasar a 2D", async ({ page }) => {
    await openExplorer(page);
    await page.getByRole("button", { name: "3D", exact: true }).click();
    await orbitButton(page).click();
    await canvas(page).focus();
    await page.keyboard.press("ArrowLeft");
    await expect(orbitButton(page)).toHaveText("Girar");
    await page.getByRole("button", { name: "3D", exact: true }).click();
    await orbitButton(page).click();
    await page.getByRole("button", { name: "2D", exact: true }).click();
    await expect(orbitButton(page)).toHaveText("Girar");
    await expect(orbitButton(page)).toBeDisabled();
  });

  test("pulsar una celda muestra sus valores y el detalle se cierra", async ({ page }) => {
    await openExplorer(page);
    await page.getByRole("button", { name: "2D", exact: true }).click();
    // Centring fits the study window to the canvas, so its middle lands on a cell.
    await page.getByRole("button", { name: "Centrar" }).click();
    await page.waitForTimeout(2000);
    await canvas(page).scrollIntoViewIfNeeded();
    const box = (await canvas(page).boundingBox())!;
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    const inspector = page.getByRole("complementary", { name: "Celda seleccionada" });
    await expect(inspector).toContainText("LST");
    await expect(inspector).toContainText("°C");
    await inspector.getByRole("button", { name: "Cerrar y deseleccionar celda" }).click();
    await expect(inspector).toHaveCount(0);
  });

  test("sin teselas externas el mapa avisa y la tabla sigue disponible", async ({ page }) => {
    await openExplorer(page);
    await expect(page.getByText("No se pudo cargar parte del mapa. La tabla sigue disponible.")).toBeVisible();
    await expect(page.getByRole("table", { name: /Comparación descriptiva/ })).toBeVisible();
  });

  test("al volver al explorador no se acumulan mapas", async ({ page }) => {
    await openExplorer(page);
    for (let i = 0; i < 3; i++) {
      await page.getByRole("link", { name: "Informes", exact: true }).first().click();
      await expect(page).toHaveURL(/informes/);
      await page.getByRole("link", { name: "Explorador", exact: true }).first().click();
      await expect(page.getByRole("button", { name: "Centrar" })).toBeEnabled({ timeout: 20_000 });
    }
    await expect(canvas(page)).toHaveCount(1);
  });
});

test.describe("regresiones de accesibilidad del mapa", () => {
  test("QA-03: el giro se detiene al usar los controles de navegación del mapa", async ({ page }) => {
    await openExplorer(page);
    await page.getByRole("button", { name: "3D", exact: true }).click();
    await orbitButton(page).click();
    await page.locator(".maplibregl-ctrl-zoom-in").click();
    await expect(orbitButton(page)).toHaveText("Girar");
  });

  test("QA-04: perder el contexto WebGL avisa y remite a la tabla", async ({ page }) => {
    await openExplorer(page);
    await canvas(page).evaluate((element: HTMLCanvasElement) => {
      const gl = element.getContext("webgl2") ?? element.getContext("webgl");
      gl?.getExtension("WEBGL_lose_context")?.loseContext();
    });
    await expect(page.locator(".map-warning[role=alert]").filter({ hasText: /tabla/ })).toBeVisible();
  });

  test("QA-05: los controles del mapa se anuncian en español", async ({ page }) => {
    await openExplorer(page);
    await expect(page.locator(".maplibregl-ctrl-zoom-in")).not.toHaveAttribute("aria-label", "Zoom in");
    await expect(canvas(page)).not.toHaveAttribute("aria-label", "Map");
  });

  test("QA-06: controles del mapa con objetivo táctil de 44 px en móvil", async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 800 }, hasTouch: true, isMobile: true });
    const page = await context.newPage();
    await openExplorer(page);
    const heights = await page
      .locator(".camera-tools button, .mode-switch button")
      .evaluateAll((buttons) => buttons.map((b) => b.getBoundingClientRect().height));
    expect(Math.min(...heights)).toBeGreaterThanOrEqual(44);
    await context.close();
  });
});


test("la presentación colorea diferencias comparables y mantiene controles en pantalla completa", async ({ page, request }) => {
  await useScenario("available");
  const response = await request.get(`${FIXTURES_URL}/v1/explorer`);
  const { evidence } = await response.json();
  const current = evidence.scenes[evidence.scenes.length - 1];
  const reference = evidence.scenes[0];
  await openExplorer(page);
  await page.getByText("Fechas y variable", { exact: true }).click();
  await page.getByLabel("Fecha del mapa", { exact: true }).selectOption(current.id);
  await page.getByLabel("Fecha de referencia", { exact: true }).selectOption(reference.id);
  await page.getByRole("button", { name: "Diferencias", exact: true }).click();
  const legend = page.getByRole("complementary", { name: "Leyenda de datos del mapa" });
  await expect(legend).toContainText(`${current.acquired_at.slice(0, 10)} menos ${reference.acquired_at.slice(0, 10)}`);
  const values = current.cells.flatMap((cell: { bounds: number[]; lst: number | null }) => {
    const before = reference.cells.find((candidate: { bounds: number[] }) => JSON.stringify(candidate.bounds) === JSON.stringify(cell.bounds));
    return before?.lst == null || cell.lst == null ? [] : [cell.lst - before.lst];
  });
  await expect(legend).toContainText(`Rango: ${Math.min(...values).toFixed(1)} a ${Math.max(...values).toFixed(1)}`);
  await page.getByRole("button", { name: "Pantalla completa", exact: true }).click();
  await expect(page.locator(".map-shell")).toHaveAttribute("data-fs-cinema", "done");
  await expect(page.getByLabel("Fecha del mapa", { exact: true })).toBeVisible();
  await expect(legend).toBeVisible();
  await page.getByLabel("Dato del mapa", { exact: true }).selectOption("ndvi");
  await expect(legend).toContainText("Diferencia de NDVI");
  await page.getByRole("button", { name: "Salir de pantalla completa", exact: true }).click();
  await expect(page.locator("canvas.maplibregl-canvas")).toHaveCount(1);
});


test("diferencias sin observaciones conserva faltantes, no ceros", async ({ page }) => {
  await useScenario("partial");
  await openExplorer(page);
  await page.getByText("Fechas y variable", { exact: true }).click();
  await page.getByLabel("Fecha del mapa", { exact: true }).selectOption("DEMO-SINTETICA-2024-07");
  await page.getByLabel("Fecha de referencia", { exact: true }).selectOption("DEMO-SINTETICA-2022-07");
  await page.getByRole("button", { name: "Diferencias", exact: true }).click();
  const legend = page.getByRole("complementary", { name: "Leyenda de datos del mapa" });
  await expect(legend).toContainText("Sin celdas coincidentes con datos");
  await expect(legend).not.toContainText("Rango:");
});
