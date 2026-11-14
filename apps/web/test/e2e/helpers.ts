import { expect, type Page } from "@playwright/test";

export const FIXTURES_PORT = 8110;
export const WEB_PORT = 3110;
export const FIXTURES_URL = `http://127.0.0.1:${FIXTURES_PORT}`;

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
