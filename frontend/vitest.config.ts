import { defineConfig } from "vitest/config";

// Unit/component tests run in jsdom. `server.fs.allow` mirrors vite.config so
// the app's imports from ../shared and ../deployments resolve during tests.
export default defineConfig({
  server: { fs: { allow: [".."] } },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts"],
    // Playwright specs live in e2e/ and are run by `playwright test`, not vitest.
    exclude: ["e2e/**", "node_modules/**"],
  },
});
