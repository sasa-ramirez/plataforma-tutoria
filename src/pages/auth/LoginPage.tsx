import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { GraduationCap } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/common/Spinner";

export function LoginPage() {
  const { signIn, resendConfirmation } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  // Si llegamos aquí desde una ruta protegida (p. ej. /j/:code), volvemos a ella.
  const from =
    (location.state as { from?: { pathname: string } } | null)?.from?.pathname ??
    "/app";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [needsConfirm, setNeedsConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNeedsConfirm(false);
    setLoading(true);
    try {
      await signIn(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "No se pudo iniciar sesión";
      // Mensaje claro + opción de reenviar si falta confirmar el correo
      if (/not confirmed|confirm/i.test(msg)) {
        setNeedsConfirm(true);
        setError("Tu correo aún no está confirmado. Revisa tu bandeja o reenvía el enlace.");
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!email) return;
    try {
      await resendConfirmation(email);
      toast("Correo de confirmación reenviado 📨", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "No se pudo reenviar", "error");
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      <div className="pointer-events-none absolute -top-24 left-1/2 size-72 -translate-x-1/2 rounded-full bg-primary/25 blur-3xl" />
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="w-full max-w-sm"
      >
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-3 grid size-14 place-items-center rounded-2xl gradient-brand text-white surface-glow">
            <GraduationCap className="size-7" />
          </div>
          <span className="mb-2 text-2xl font-extrabold tracking-tight text-gradient">
            Kódea
          </span>
          <h1 className="text-xl font-bold tracking-tight">
            Bienvenido de vuelta
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Continúa aprendiendo a programar 🚀
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Correo</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              placeholder="tucorreo@uni.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Contraseña</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && (
            <div className="space-y-2 rounded-lg bg-destructive/10 px-3 py-2">
              <p className="text-sm text-destructive">{error}</p>
              {needsConfirm && (
                <button
                  type="button"
                  onClick={handleResend}
                  className="text-sm font-semibold text-primary underline-offset-2 hover:underline"
                >
                  Reenviar correo de confirmación
                </button>
              )}
            </div>
          )}

          <Button
            type="submit"
            variant="brand"
            size="lg"
            className="w-full"
            disabled={loading}
          >
            {loading ? <Spinner className="size-4" /> : "Iniciar sesión"}
          </Button>

          <div className="text-center">
            <Link
              to="/forgot-password"
              className="text-sm font-medium text-muted-foreground hover:text-primary"
            >
              ¿Olvidaste tu contraseña?
            </Link>
          </div>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          ¿No tienes cuenta?{" "}
          <Link to="/register" className="font-semibold text-primary">
            Regístrate
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
