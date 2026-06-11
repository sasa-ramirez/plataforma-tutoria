import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    host: true,
  },
  build: {
    rollupOptions: {
      output: {
        // Separa las librerías pesadas en chunks aparte para que la carga
        // inicial sea ligera (mobile-first). Monaco solo se descarga al
        // entrar al editor; Recharts solo en pantallas con gráficos.
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          monaco: ["@monaco-editor/react"],
          charts: ["recharts"],
          katex: ["katex"],
          motion: ["framer-motion"],
          supabase: ["@supabase/supabase-js"],
        },
      },
    },
  },
});
