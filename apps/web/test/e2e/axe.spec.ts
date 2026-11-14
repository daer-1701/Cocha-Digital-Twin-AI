import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { useScenario } from "./helpers";

const KANATA = "00000000-0000-4000-8000-000000005a01";
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

// Open incidents in docs/qa-report.md; their own fixme tests below fail until fixed.
const KNOWN = new Set([
  "scrollable-region-focusable", // QA-01
  "link-in-text-block", // QA-02, MapLibre attribution
]);

const PAGES: [scenario: string, route: string][] = [
  ["available", "/"],
  ["available", "/comparar"],
  ["valle", "/comparar"],
  ["available", "/estaciones"],
  ["available", "/informes"],
  ["available", "/modelos"],
  ["available", "/escenarios"],
  ["available", "/asistente"],
  ["monica-review", "/procesamiento"],
  ["monica-review", `/estaciones/${KANATA}`],
  ["partial", "/"],
  ["error", "/"],
];

async function violations(page: Page) {
  const result = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  return result.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
}

for (const width of [1280, 390])
  test.describe(`axe WCAG 2.2 AA a ${width} px`, () => {
    test.use({ viewport: { width, height: 900 } });

    for (const [scenario, route] of PAGES)
      test(`${route} (${scenario}) sin incumplimientos nuevos`, async ({ page }) => {
        await useScenario(scenario);
        await page.goto(route);
        await expect(page.locator("main h1")).toBeVisible();
        const found = await violations(page);
        expect(found.filter((v) => !KNOWN.has(v.split(" ")[0]))).toEqual([]);
      });
  });

test.describe("incidencias de accesibilidad abiertas", () => {
  test.fixme("QA-01: las tablas con desplazamiento horizontal se alcanzan con teclado", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    await useScenario("monica-review");
    for (const route of ["/informes", "/procesamiento", `/estaciones/${KANATA}`]) {
      await page.goto(route);
      expect((await violations(page)).filter((v) => v.startsWith("scrollable-region-focusable"))).toEqual([]);
    }
  });

  test.fixme("QA-02: los enlaces de atribución del mapa se distinguen sin depender del color", async ({ page }) => {
    await useScenario("available");
    await page.goto("/");
    await expect(page.locator(".maplibregl-ctrl-attrib")).toBeAttached();
    expect((await violations(page)).filter((v) => v.startsWith("link-in-text-block"))).toEqual([]);
  });
});
