import { Component, type ReactNode } from "react";
import { TriangleAlert } from "lucide-react";
import { reportError } from "@/lib/sentry";

/** Si algo revienta al pintar el quiz, el estudiante ve un "Reintentar"
 * amable en vez de la pantalla técnica de toda la app. Su progreso vive en
 * el servidor, así que al reintentar vuelve exactamente donde iba. */
export class QuizErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: unknown) {
    console.error("[QuizErrorBoundary]", error, info);
    reportError(error, { info, where: "quiz" });
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <TriangleAlert className="size-10 text-warning" />
        <div>
          <p className="text-lg font-bold">Se trabó la pantalla del quiz</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Tu avance está guardado. Toca el botón para volver donde ibas.
          </p>
        </div>
        <button
          type="button"
          onClick={() => this.setState({ failed: false })}
          className="rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground"
        >
          Reintentar
        </button>
      </div>
    );
  }
}
