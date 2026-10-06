import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// A relative base keeps the generated app portable across root domains,
// subdirectories, CDNs, and simple local static servers.
export default defineConfig({
  base: "./",
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "."),
    },
  },
  server: process.env.CODEX_SANDBOX === "seatbelt"
    ? { watch: { useFsEvents: false, usePolling: true } }
    : undefined,
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
