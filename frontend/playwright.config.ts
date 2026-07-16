import { defineConfig, devices } from "@playwright/test";

/**
 * E2E smoke tests for the CryptoWordle frontend. These verify the app boots and
 * the "Treasury Certificate" UI shell renders and reacts to input — without a
 * wallet or chain (the guess/claim flow is covered by the contract integration
 * suite). `webServer` builds and previews the production bundle so the tests run
 * against the same artifact users get.
 *
 * One-time setup: `npx playwright install chromium`.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "list" : "line",
  use: {
    baseURL: "http://localhost:4173",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run build && npm run preview -- --port 4173 --strictPort",
    url: "http://localhost:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
