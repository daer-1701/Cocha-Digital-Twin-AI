import { expect, test } from "@playwright/test";
import { horizontalOverflow, useScenario } from "./helpers";

const ROUTES = ["/", "/comparar", "/estaciones", "/informes", "/modelos", "/escenarios", "/asistente"];

// 320 CSS px is the WCAG 1.4.10 reflow width; 390 px is a common phone.
for (const width of [320, 390])
  test.describe(`móvil ${width} px`, () => {
    test.use({ viewport: { width, height: 800 } });
    test.beforeEach(() => useScenario("wms"));

    for (const route of ROUTES)
      test(`sin desbordamiento horizontal global en ${route}`, async ({ page }) => {
        await page.goto(route);
        await expect(page.locator("main h1")).toBeVisible();
        expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
      });
  });

test.describe("teclado y estructura", () => {
  test.beforeEach(() => useScenario("available"));

  test("el primer Tab ofrece saltar al contenido", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Saltar al contenido" });
    await expect(skip).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#contenido$/);
  });

  for (const route of ROUTES)
    test(`${route} tiene un único h1 y controles con nombre`, async ({ page }) => {
      await page.goto(route);
      await expect(page.locator("h1")).toHaveCount(1);
      const duplicateIds = await page.evaluate(() => {
        const ids = [...document.querySelectorAll("[id]")].map((el) => el.id);
        return ids.filter((id, index) => ids.indexOf(id) !== index);
      });
      expect(duplicateIds).toEqual([]);
      const unnamed = await page.evaluate(() =>
        [...document.querySelectorAll("input, select, button, a[href]")]
          .filter((el) => {
            const html = el as HTMLElement;
            if (html.closest("[hidden]") || html.getClientRects().length === 0) return false;
            const field = el.matches("input, select");
            const labelled =
              (el as HTMLInputElement).labels?.length ||
              el.getAttribute("aria-label") ||
              el.getAttribute("aria-labelledby") ||
              (!field && html.innerText.trim());
            return !labelled;
          })
          .map((el) => el.outerHTML.slice(0, 120)),
      );
      expect(unnamed).toEqual([]);
    });

  test("sin WebGL el explorador conserva tabla y explica el mapa", async ({ page }) => {
    await page.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...args: unknown[]) {
        if (type.startsWith("webgl")) return null;
        return (original as (...a: unknown[]) => RenderingContext | null).call(this, type, ...args);
      } as typeof original;
    });
    await page.goto("/");
    await expect(page.getByText(/WebGL/)).toBeVisible();
    await expect(page.getByRole("table", { name: /Comparación descriptiva/ })).toBeVisible();
  });
});
