import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Keep browser requests on the app origin. Vite forwards them to the local
// renderer, avoiding browser-dependent cross-origin localhost restrictions.
const ctvOttProxy = {
  "/api/ctv-ott": {
    target: "http://127.0.0.1:4177",
    changeOrigin: true,
    rewrite: (requestPath: string) => requestPath.replace(/^\/api\/ctv-ott/, ""),
  },
};

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
  server: {
    proxy: ctvOttProxy,
    ...(process.env.CODEX_SANDBOX === "seatbelt"
      ? { watch: { useFsEvents: false, usePolling: true } }
      : {}),
  },
  preview: { proxy: ctvOttProxy },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
