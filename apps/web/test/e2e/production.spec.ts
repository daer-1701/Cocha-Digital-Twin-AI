import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { FIXTURES_PORT, FIXTURES_URL, STRICT_WEB_URL, useScenario } from "./helpers";

const ROUTES = [
  "/",
  "/comparar",
  "/estaciones",
  "/informes",
  "/modelos",
  "/escenarios",
  "/asistente",
  "/procesamiento",
];

test.describe("AC26: un build de producción bloquea los datos sintéticos", () => {
  test.beforeEach(() => useScenario("monica-review"));

  for (const route of ROUTES)
    test(`${route} avisa del bloqueo y no muestra valores sintéticos`, async ({ page }) => {
      await page.goto(STRICT_WEB_URL + route);
      await expect(page.getByRole("note").filter({ hasText: "Producción los bloquea" })).toBeVisible();
      await expect(page.getByText("Datos sintéticos de desarrollo")).toHaveCount(0);
      await expect(page.locator("main")).not.toContainText("DEMO-SINTETICA");
      await expect(page.locator("main")).not.toContainText("DEMO Kanata");
      await expect(page.locator(".metrics")).toHaveCount(0);
    });

  test("las descargas responden 503 y no entregan valores", async ({ request }) => {
    for (const format of ["csv", "json"]) {
      const response = await request.get(`${STRICT_WEB_URL}/api/informes/${format}?contenido=escenas`);
      expect(response.status(), format).toBe(503);
      expect(await response.text(), format).not.toContain("DEMO-SINTETICA");
    }
  });
});

test.describe("AC27: secretos y API interna solo en el servidor", () => {
  test("el JavaScript del cliente no contiene nombres de claves ni la URL interna", async () => {
    const root = path.resolve(__dirname, "../../.next/static");
    const files = (await readdir(root, { recursive: true })).filter((file) => file.endsWith(".js"));
    expect(files.length, "ejecutar npm run build antes de las pruebas").toBeGreaterThan(0);
    const forbidden = [
      "GEMINI_API_KEY",
      "GAMC_WMS_API_KEY",
      "API_WRITE_TOKEN",
      "DATABASE_URL",
      "POSTGRES_PASSWORD",
      "API_INTERNAL_URL",
      "localhost:8000",
      `127.0.0.1:${FIXTURES_PORT}`,
    ];
    const leaks: string[] = [];
    for (const file of files) {
      const text = await readFile(path.join(root, file), "utf8");
      for (const token of forbidden) if (text.includes(token)) leaks.push(`${file}: ${token}`);
    }
    expect(leaks).toEqual([]);
  });

  test("el navegador nunca llama a la API directamente", async ({ page }) => {
    await useScenario("wms");
    const direct: string[] = [];
    page.on("request", (request) => {
      if (request.url().startsWith(FIXTURES_URL)) direct.push(request.url());
    });
    for (const route of ROUTES) {
      const response = await page.goto(route);
      expect(await response!.text(), route).not.toContain(FIXTURES_URL);
    }
    await page.goto("/");
    await page.getByRole("checkbox", { name: "Límite urbano" }).check();
    await expect(page.getByRole("img", { name: "Leyenda de la capa Límite urbano" })).toBeVisible();
    expect(direct).toEqual([]);
  });
});
