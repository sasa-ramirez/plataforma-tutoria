import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** true solo si AMBAS variables existen en el build. */
export const isSupabaseConfigured = Boolean(url && anonKey);

if (!isSupabaseConfigured) {
  console.error(
    "[supabase] Faltan VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. " +
      "Configúralas en Vercel (Settings → Environment Variables) y vuelve a desplegar.",
  );
}

// Usamos placeholders válidos si faltan, para que createClient NO lance una
// excepción al cargar el módulo (eso dejaría la pantalla en negro). En su lugar,
// main.tsx muestra una pantalla de configuración clara cuando isSupabaseConfigured es false.
export const supabase = createClient(
  url || "https://placeholder.supabase.co",
  anonKey || "placeholder-anon-key",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
);
