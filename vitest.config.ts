import { defineConfig } from "vite";
import path from "path";

// Config aparte de vite.config.ts (no server.host:true) — Vitest no
// necesita quedar expuesto en la red como sí el dev server de la app.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
