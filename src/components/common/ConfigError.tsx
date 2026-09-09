import { Unplug } from "lucide-react";

/** Pantalla clara cuando faltan las variables de entorno de Supabase. */
export function ConfigError() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 14,
        padding: 24,
        background: "#0E1517",
        color: "#F2EEE6",
        fontFamily: "Inter, system-ui, sans-serif",
        textAlign: "center",
      }}
    >
      <Unplug size={40} color="#5CC0D0" strokeWidth={1.75} />
      <h1 style={{ fontSize: 22, fontWeight: 800 }}>Falta conectar Supabase</h1>
      <p style={{ fontSize: 14, opacity: 0.75, maxWidth: 460, lineHeight: 1.5 }}>
        No se encontraron las variables de entorno al compilar. Añádelas en
        Vercel (<strong>Settings → Environment Variables</strong>) y vuelve a
        desplegar <em>sin caché</em>:
      </p>
      <pre
        style={{
          background: "#161F22",
          padding: 16,
          borderRadius: 12,
          fontSize: 12,
          textAlign: "left",
          color: "#5CC0D0",
        }}
      >
        VITE_SUPABASE_URL{"\n"}
        VITE_SUPABASE_ANON_KEY
      </pre>
      <p style={{ fontSize: 12, opacity: 0.55, maxWidth: 460 }}>
        En Vite las variables se incrustan al compilar, por eso un redeploy es
        obligatorio después de añadirlas.
      </p>
    </div>
  );
}
