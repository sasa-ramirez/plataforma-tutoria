import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/context/AuthContext";
import { ToastProvider } from "@/components/ui/toast";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { ConfigError } from "@/components/common/ConfigError";
import { isSupabaseConfigured } from "@/lib/supabase";
import { initSentry } from "@/lib/sentry";
import App from "@/App";
import "@/index.css";

initSentry();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
  },
});

/** Cada deploy cambia el nombre de los archivos de cada módulo (hash en el
 * nombre). Si alguien deja la pestaña abierta desde antes de un deploy y
 * luego dispara un import() dinámico (exportar Excel/Word, etc.), el
 * navegador busca el archivo viejo y ya no existe → Vite dispara este
 * evento. Recargamos una sola vez para traer la versión nueva; el guard en
 * sessionStorage evita un bucle infinito si el problema es de red real. */
window.addEventListener("vite:preloadError", () => {
  const key = "reloaded-after-preload-error";
  if (sessionStorage.getItem(key)) return;
  sessionStorage.setItem(key, "1");
  window.location.reload();
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      {isSupabaseConfigured ? (
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <AuthProvider>
              <ToastProvider>
                <App />
              </ToastProvider>
            </AuthProvider>
          </BrowserRouter>
        </QueryClientProvider>
      ) : (
        <ConfigError />
      )}
    </ErrorBoundary>
  </React.StrictMode>,
);
