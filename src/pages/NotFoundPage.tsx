import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-7xl font-extrabold text-gradient">404</p>
      <h1 className="text-xl font-bold">Página no encontrada</h1>
      <p className="max-w-xs text-sm text-muted-foreground">
        La ruta que buscas no existe o fue movida.
      </p>
      <Button asChild variant="brand">
        <Link to="/app">Volver al inicio</Link>
      </Button>
    </div>
  );
}
