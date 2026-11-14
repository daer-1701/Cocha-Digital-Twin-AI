import { expect, test, type Page } from "@playwright/test";
import { useScenario } from "./helpers";

// External basemap and relief tiles are blocked: tests stay deterministic and do not load OSM servers.
const EXTERNAL_TILES = /tile\.openstreetmap\.org|elevation-tiles-prod/;

test.beforeEach(() => useScenario("available"));

async function openExplorer(page: Page) {
  await page.route(EXTERNAL_TILES, (route) => route.abort());
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Centrar vista" })).toBeEnabled({ timeout: 20_000 });
}

const orbitButton = (page: Page) => page.locator(".camera-tools button").first();
const canvas = (page: Page) => page.locator("canvas.maplibregl-canvas");

test.describe("interacción 3D del explorador", () => {
  test("con movimiento reducido arranca en 2D y no ofrece giro", async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: "reduce" });
    const page = await context.newPage();
    await openExplorer(page);
    await expect(page.getByRole("button", { name: "Plano 2D", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("button", { name: "Girar el valle" })).toBeDisabled();
    await context.close();
  });

  test("el giro es optativo y se detiene al tocar el mapa", async ({ page }) => {
    await openExplorer(page);
    await expect(page.getByRole("button", { name: "Relieve 3D", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(orbitButton(page)).toHaveText("Girar el valle");
    await orbitButton(page).click();
    await expect(orbitButton(page)).toHaveText("Detener giro");
    await expect(orbitButton(page)).toHaveAttribute("aria-pressed", "true");
    const box = (await canvas(page).boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.up();
    await expect(orbitButton(page)).toHaveText("Girar el valle");
  });

  test("el giro se detiene con el teclado sobre el mapa y al pasar a 2D", async ({ page }) => {
    await openExplorer(page);
    await orbitButton(page).click();
    await canvas(page).focus();
    await page.keyboard.press("ArrowLeft");
    await expect(orbitButton(page)).toHaveText("Girar el valle");
    await orbitButton(page).click();
    await page.getByRole("button", { name: "Plano 2D", exact: true }).click();
    await expect(orbitButton(page)).toHaveText("Girar el valle");
    await expect(orbitButton(page)).toBeDisabled();
  });

  test("pulsar una celda muestra sus valores y el detalle se cierra", async ({ page }) => {
    await openExplorer(page);
    await page.getByRole("button", { name: "Plano 2D", exact: true }).click();
    // Centring fits the study window to the canvas, so its middle lands on a cell.
    await page.getByRole("button", { name: "Centrar vista" }).click();
    await page.waitForTimeout(2000);
    const box = (await canvas(page).boundingBox())!;
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    const inspector = page.getByRole("complementary", { name: "Celda seleccionada" });
    await expect(inspector).toContainText("LST");
    await expect(inspector).toContainText("°C");
    await inspector.getByRole("button", { name: "Cerrar detalle de celda" }).click();
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
      await expect(page.getByRole("button", { name: "Centrar vista" })).toBeEnabled({ timeout: 20_000 });
    }
    await expect(canvas(page)).toHaveCount(1);
  });
});

test.describe("incidencias 3D abiertas", () => {
  test.fixme("QA-03: el giro se detiene al usar los controles de navegación del mapa", async ({ page }) => {
    await openExplorer(page);
    await orbitButton(page).click();
    await page.locator(".maplibregl-ctrl-zoom-in").click();
    await expect(orbitButton(page)).toHaveText("Girar el valle");
  });

  test.fixme("QA-04: perder el contexto WebGL avisa y remite a la tabla", async ({ page }) => {
    await openExplorer(page);
    await canvas(page).evaluate((element: HTMLCanvasElement) => {
      const gl = element.getContext("webgl2") ?? element.getContext("webgl");
      gl?.getExtension("WEBGL_lose_context")?.loseContext();
    });
    await expect(page.locator(".map-warning, .map-placeholder").filter({ hasText: /tabla/ })).toBeVisible();
  });

  test.fixme("QA-05: los controles del mapa se anuncian en español", async ({ page }) => {
    await openExplorer(page);
    await expect(page.locator(".maplibregl-ctrl-zoom-in")).not.toHaveAttribute("aria-label", "Zoom in");
    await expect(canvas(page)).not.toHaveAttribute("aria-label", "Map");
  });

  test.fixme("QA-06: controles del mapa con objetivo táctil de 44 px en móvil", async ({ browser }) => {
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
