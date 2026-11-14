import { expect, test } from "@playwright/test";
import { expectDemo, useScenario } from "./helpers";

test.describe("explorador con tres escenas sintéticas", () => {
  test.beforeEach(() => useScenario("available"));

  test("rotula la demo y deshabilita distritos con el motivo del servidor", async ({ page }) => {
    await page.goto("/");
    await expectDemo(page);
    await expect(page.getByRole("radio", { name: /DEMO/ })).toBeChecked();
    await expect(page.getByRole("radio", { name: "Distritos con análisis" })).toBeDisabled();
    await expect(page.getByText("Sintético").first()).toBeVisible();
  });

  test("fecha, comparación y variable quedan en la URL y la vista", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Fecha de adquisición").selectOption("DEMO-SINTETICA-2022-07");
    await expect(page).toHaveURL(/escena=DEMO-SINTETICA-2022-07/);
    await expect(page.getByRole("region", { name: "Indicadores del 2022-07-15" })).toBeVisible();

    await page.getByLabel("Comparar con").selectOption("DEMO-SINTETICA-2024-07");
    await expect(page).toHaveURL(/comparar=DEMO-SINTETICA-2024-07/);
    const comparison = page.locator(".comparison");
    await expect(comparison.getByRole("heading", { name: "Comparación entre dos fechas" })).toBeVisible();
    await expect(comparison).toContainText("no indica una tendencia");

    await page.getByLabel("Variable", { exact: true }).selectOption("ndvi");
    await expect(page).toHaveURL(/variable=ndvi/);
    await expect(page.getByText(/Pendiente descriptiva del NDVI en la ventana piloto/)).toBeVisible();

    await page.reload();
    await expect(page.getByLabel("Fecha de adquisición")).toHaveValue("DEMO-SINTETICA-2022-07");
    await expect(page.getByLabel("Comparar con")).toHaveValue("DEMO-SINTETICA-2024-07");
  });

  test("la pendiente del piloto es descriptiva y no se presenta como tendencia distrital", async ({
    page,
  }) => {
    await page.goto("/?variable=lst");
    const slope = page.locator(".pilot-slope");
    await expect(slope).toContainText("+1.00 °C");
    await expect(slope).toContainText("3 escenas con valor; mínimo requerido: 3");
    await expect(slope).toContainText("no es una tendencia por distrito");
    await expect(page.getByText(/Por distrito, todavía no/)).toBeVisible();
  });

  test("la tabla lista todas las escenas y marca la seleccionada", async ({ page }) => {
    await page.goto("/?escena=DEMO-SINTETICA-2023-07");
    const table = page.getByRole("table", { name: /Comparación descriptiva entre adquisiciones/ });
    await expect(table.getByRole("row")).toHaveCount(4);
    await expect(table.locator('tr[aria-current="true"]')).toContainText("2023-07-15");
  });

  test("un enlace con filtros inválidos avisa en lugar de fallar", async ({ page }) => {
    await page.goto("/?escena=NO-EXISTE&variable=pm10&territorio=distritos");
    const notice = page.locator(".link-notice");
    await expect(notice).toContainText("La escena del enlace no está en los datos publicados");
    await expect(notice).toContainText("La variable del enlace no es válida");
    await expect(notice).toContainText("El territorio del enlace todavía no está disponible");
  });
});

test.describe("estados del explorador", () => {
  test("cobertura parcial: huecos como Sin datos y pendiente no concluyente", async ({ page }) => {
    await useScenario("partial");
    await page.goto("/?escena=DEMO-SINTETICA-2024-07");
    await expect(page.getByText("Esta escena no tiene píxeles válidos")).toBeVisible();
    const table = page.getByRole("table", { name: /Comparación descriptiva/ });
    await expect(table.locator('tr[aria-current="true"]')).toContainText("Sin datos");
    await expect(page.locator(".pilot-slope")).toContainText("no concluyente");
    await expect(page.locator(".pilot-slope")).toContainText("2 escenas con valor");
  });

  test("sin snapshot publicado", async ({ page }) => {
    await useScenario("empty");
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "Todavía no hay observaciones publicadas" }),
    ).toBeVisible();
    await expect(page.locator(".metrics")).toHaveCount(0);
  });

  test("snapshot sin escenas", async ({ page }) => {
    await useScenario("no-scenes");
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "No hay escenas publicadas para esta área" }),
    ).toBeVisible();
  });

  test("API lenta: al superar el tiempo de espera se informa el error", async ({ page }) => {
    await useScenario("slow");
    await page.goto("/");
    await expect(page.locator("main").getByRole("alert")).toContainText(
      "No se pudo consultar la evidencia",
    );
    await expect(page.locator(".metrics")).toHaveCount(0);
  });

  test("error de la API", async ({ page }) => {
    await useScenario("error");
    await page.goto("/");
    await expect(page.locator("main").getByRole("alert")).toContainText(
      "No se pudo consultar la evidencia",
    );
  });
});
