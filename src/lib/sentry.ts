import * as Sentry from "@sentry/react";

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined;

/** Es ADITIVO: si no hay DSN configurado, no hace nada y la app funciona
 * igual (mismo patrón que enablePush con VITE_VAPID_PUBLIC_KEY). */
export function initSentry() {
  if (!SENTRY_DSN) return;
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: import.meta.env.MODE,
    // Solo errores, sin trazas de performance — de sobra para el tamaño
    // de este proyecto y se queda bien dentro del plan gratis.
    tracesSampleRate: 0,
    sendDefaultPii: false,
  });
}

/** Manda un error a Sentry si está configurado; si no, no hace nada
 * (usar junto con console.error, no en vez de). */
export function reportError(error: unknown, context?: Record<string, unknown>) {
  if (!SENTRY_DSN) return;
  Sentry.captureException(error, context ? { extra: context } : undefined);
}
