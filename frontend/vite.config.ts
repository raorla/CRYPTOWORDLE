import { defineConfig } from "vite";

export default defineConfig({
  // The app imports the committed ABI, word lists and deployment record from
  // the repo root (../shared, ../deployments) — allow them in dev.
  server: {
    fs: { allow: [".."] },
  },
  build: {
    target: "es2022",
    outDir: "dist",
  },
});
