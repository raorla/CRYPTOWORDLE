import { defineConfig } from "vite";

export default defineConfig({
  // Relative asset paths so the same bundle works at the domain root, under
  // a sub-path (GitHub Pages /CRYPTOWORDLE/), or from a local preview.
  base: "./",
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
