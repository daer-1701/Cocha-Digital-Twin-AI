import { expect, type Page } from "@playwright/test";

export const FIXTURES_PORT = 8110;
export const WEB_PORT = 3110;
/** Same production build without ALLOW_SYNTHETIC_FIXTURES: must block the fixtures. */
export const STRICT_WEB_PORT = 3111;
export const FIXTURES_URL = `http://127.0.0.1:${FIXTURES_PORT}`;
export const STRICT_WEB_URL = `http://127.0.0.1:${STRICT_WEB_PORT}`;

/** Switches the synthetic API; every page fetches with no-store, so the next navigation sees it. */
export async function useScenario(name: string) {
  const response = await fetch(`${FIXTURES_URL}/__fixtures/scenario/${name}`, {
    method: "POST",
  });
  expect(response.ok, `fixture scenario "${name}"`).toBe(true);
}

export async function expectDemo(page: Page) {
  await expect(page.getByRole("note").filter({ hasText: "Datos sintéticos" })).toBeVisible();
}

export async function horizontalOverflow(page: Page) {
  return page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
}
