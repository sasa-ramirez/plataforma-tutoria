import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { KeyRound, MailCheck } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/common/Spinner";

export function ForgotPasswordPage() {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await resetPassword(email);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo enviar el correo");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      <div className="pointer-events-none absolute -top-24 left-1/2 size-72 -translate-x-1/2 rounded-full bg-primary/25 blur-3xl" />
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        {sent ? (
          <div className="text-center">
            <div className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl bg-success/15 text-success">
              <MailCheck className="size-7" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">Revisa tu correo 📨</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Si <span className="font-semibold">{email}</span> tiene una cuenta,
              te enviamos un enlace para crear una nueva contraseña. Revisa también
              spam.
            </p>
            <Button asChild variant="outline" className="mt-6 w-full">
              <Link to="/login">Volver a iniciar sesión</Link>
            </Button>
          </div>
        ) : (
          <>
            <div className="mb-8 flex flex-col items-center text-center">
              <div className="mb-3 grid size-14 place-items-center rounded-2xl gradient-brand text-white surface-glow">
                <KeyRound className="size-7" />
              </div>
              <h1 className="text-xl font-bold tracking-tight">
                ¿Olvidaste tu contraseña?
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Escribe tu correo y te enviamos un enlace para recuperarla.
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
                  autoFocus
                />
              </div>

              {error && (
                <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </p>
              )}

              <Button
                type="submit"
                variant="brand"
                size="lg"
                className="w-full"
                disabled={loading}
              >
                {loading ? <Spinner className="size-4" /> : "Enviar enlace"}
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              <Link to="/login" className="font-semibold text-primary">
                Volver a iniciar sesión
              </Link>
            </p>
          </>
        )}
      </motion.div>
    </div>
  );
}
