import { expect, test } from "@playwright/test";
import { useScenario } from "./helpers";

const URBAN_LIMIT = "fd77d463-9729-4c66-b686-23dccbb4ab8f";

test.describe("capas municipales WMS", () => {
  test("sin clave en el servidor quedan deshabilitadas con motivo", async ({ page }) => {
    await useScenario("available");
    await page.goto("/");
    const layer = page.getByRole("checkbox", { name: "Límite urbano" });
    await expect(layer).toBeDisabled();
    await expect(page.locator(".map-layers")).toContainText("No disponible");
  });

  test("activar una capa muestra su leyenda a través del proxy", async ({ page }) => {
    await useScenario("wms");
    await page.goto("/");
    await page.getByRole("checkbox", { name: "Límite urbano" }).check();
    const legend = page.getByRole("img", { name: "Leyenda de la capa Límite urbano" });
    await expect(legend).toBeVisible();
    await expect
      .poll(() => legend.evaluate((img: HTMLImageElement) => img.naturalWidth))
      .toBeGreaterThan(0);
  });

  test("el proxy valida parámetros antes de llamar a la API", async ({ request }) => {
    await useScenario("wms");
    const legend = await request.get(`/api/gamc/wms/legend?service_id=${URBAN_LIMIT}`);
    expect(legend.status()).toBe(200);
    expect(legend.headers()["content-type"]).toBe("image/png");

    const badId = await request.get("/api/gamc/wms/legend?service_id=../../secret");
    expect(badId.status()).toBe(400);
    const badBox = await request.get(
      `/api/gamc/wms/map?service_id=${URBAN_LIMIT}&bbox=1,1,0,0&width=256&height=256`,
    );
    expect(badBox.status()).toBe(400);
    const tooBig = await request.get(
      `/api/gamc/wms/map?service_id=${URBAN_LIMIT}&bbox=-66.2,-17.4,-66.1,-17.3&width=5000&height=256`,
    );
    expect(tooBig.status()).toBe(400);
  });
});
