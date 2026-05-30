import { Component, type ReactNode } from "react";

interface State {
  error: Error | null;
}

/** Captura errores de render y los muestra (evita la pantalla en blanco). */
export class ErrorBoundary extends Component<
  { children: ReactNode },
  State
> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: unknown) {
    // Visible en la consola del navegador para diagnóstico.
    console.error("[ErrorBoundary]", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            padding: 24,
            background: "#0b0b12",
            color: "#e6e4f0",
            fontFamily: "Inter, system-ui, sans-serif",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 40 }}>😵</div>
          <h1 style={{ fontSize: 20, fontWeight: 800 }}>
            Algo falló al cargar la app
          </h1>
          <p style={{ fontSize: 14, opacity: 0.7, maxWidth: 420 }}>
            Mensaje técnico (compártelo para diagnosticar):
          </p>
          <pre
            style={{
              maxWidth: "90vw",
              overflow: "auto",
              background: "#1a1830",
              padding: 16,
              borderRadius: 12,
              fontSize: 12,
              color: "#ff8a8a",
              textAlign: "left",
            }}
          >
            {this.state.error.message}
            {"\n\n"}
            {this.state.error.stack?.slice(0, 600)}
          </pre>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: 8,
              padding: "10px 20px",
              borderRadius: 12,
              border: "none",
              background: "#7c5cff",
              color: "white",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Recargar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
