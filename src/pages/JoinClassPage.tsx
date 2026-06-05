import { useState } from "react";
import { useParams, useNavigate, useLocation, Navigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Radio } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { joinCourseByCode } from "@/services/courses";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/common/Spinner";

/**
 * Entrada a una clase por enlace compartido: /j/:code
 * El alumno ve el código, pulsa "Entrar" → se inscribe (si hace falta) y
 * va directo al tablero en vivo del curso.
 */
export function JoinClassPage() {
  const { code = "" } = useParams();
  const upper = code.toUpperCase();
  const { session } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  // Sin sesión → al login, volviendo a este enlace tras autenticarse.
  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const enter = async () => {
    setLoading(true);
    try {
      const course = await joinCourseByCode(upper);
      navigate(`/app/courses/${course.id}/board`, { replace: true });
    } catch (err) {
      toast(err instanceof Error ? err.message : "No se pudo entrar", "error");
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      <div className="pointer-events-none absolute -top-24 left-1/2 size-72 -translate-x-1/2 rounded-full bg-primary/25 blur-3xl" />
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm text-center"
      >
        <div className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl gradient-brand text-white surface-glow">
          <Radio className="size-7" />
        </div>
        <h1 className="text-xl font-bold tracking-tight">Entrar a la clase</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Te unirás con este código y entrarás al tablero en vivo.
        </p>

        <div className="my-6 rounded-2xl border bg-card py-4 font-mono text-3xl font-extrabold tracking-[0.3em]">
          {upper}
        </div>

        <Button
          variant="brand"
          size="lg"
          className="w-full"
          onClick={enter}
          disabled={loading || upper.length < 4}
        >
          {loading ? <Spinner className="size-4" /> : "Entrar a la clase"}
        </Button>
      </motion.div>
    </div>
  );
}
