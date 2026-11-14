import { defineConfig, devices } from "@playwright/test";
// Dedicated ports so the suite does not reuse a developer's fixtures or Next.js server.
import { FIXTURES_PORT, FIXTURES_URL, WEB_PORT } from "./test/e2e/helpers";

export default defineConfig({
  testDir: "./test/e2e",
  // The fixtures server holds one active scenario, so tests run one at a time.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://127.0.0.1:${WEB_PORT}`,
    locale: "es-BO",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "node test/fixtures/server.mjs",
      url: `${FIXTURES_URL}/__fixtures`,
      env: { FIXTURES_PORT: String(FIXTURES_PORT) },
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      // Production build (`npm run build` first); does not collide with a running `next dev`.
      command: `npx next start --port ${WEB_PORT} --hostname 127.0.0.1`,
      url: `http://127.0.0.1:${WEB_PORT}/informes`,
      env: {
        API_INTERNAL_URL: FIXTURES_URL,
        ALLOW_SYNTHETIC_FIXTURES: "1",
        NEXT_TELEMETRY_DISABLED: "1",
      },
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
