import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { GraduationCap, BookUser, MailCheck } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { requestTeacherRole } from "@/services/admin";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/common/Spinner";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/types/database";

export function RegisterPage() {
  const { signUp, resendConfirmation } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("student");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      // El backend siempre crea estudiantes; el rol no lo decide el cliente.
      const { needsConfirmation } = await signUp({
        email,
        password,
        fullName,
        role,
      });

      if (needsConfirmation) {
        // No hay sesión: hay que confirmar el correo antes de entrar.
        setSentTo(email);
        return;
      }

      // Sesión activa (confirmación desactivada): si pidió profesor, crea la solicitud.
      if (role === "teacher") {
        try {
          await requestTeacherRole();
        } catch {
          /* podrá solicitarlo desde su perfil */
        }
      }
      navigate("/app");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo registrar");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!sentTo) return;
    try {
      await resendConfirmation(sentTo);
      toast("Correo reenviado 📨", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "No se pudo reenviar", "error");
    }
  };

  // Pantalla "revisa tu correo"
  if (sentTo) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm text-center"
        >
          <div className="mx-auto mb-4 grid size-16 place-items-center rounded-2xl gradient-brand text-white surface-glow">
            <MailCheck className="size-8" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight">
            Revisa tu correo
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Enviamos un enlace de confirmación a{" "}
            <strong className="text-foreground">{sentTo}</strong>. Ábrelo para
            activar tu cuenta y poder iniciar sesión.
          </p>
          {role === "teacher" && (
            <p className="mt-3 rounded-lg bg-primary/10 px-3 py-2 text-xs text-primary">
              ℹ️ Tras confirmar e iniciar sesión, solicita ser profesor desde tu
              perfil.
            </p>
          )}
          <div className="mt-6 space-y-3">
            <Button variant="brand" className="w-full" onClick={handleResend}>
              Reenviar correo
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => navigate("/login")}
            >
              Ir a iniciar sesión
            </Button>
          </div>
          <p className="mt-4 text-xs text-muted-foreground/70">
            ¿No llega? Revisa spam o vuelve a intentar en unos minutos.
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <div className="pointer-events-none absolute -top-24 right-0 size-72 rounded-full bg-accent/25 blur-3xl" />
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="w-full max-w-sm"
      >
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 grid size-14 place-items-center rounded-2xl gradient-brand text-white surface-glow">
            <GraduationCap className="size-7" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight">
            Crea tu cuenta
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Empieza tu camino en la programación
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          {/* Selector de rol */}
          <div className="grid grid-cols-2 gap-3">
            {(
              [
                { value: "student", label: "Estudiante", icon: GraduationCap },
                { value: "teacher", label: "Profesor", icon: BookUser },
              ] as const
            ).map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setRole(opt.value)}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all active:scale-[0.98]",
                  role === opt.value
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/40",
                )}
              >
                <opt.icon
                  className={cn(
                    "size-6",
                    role === opt.value
                      ? "text-primary"
                      : "text-muted-foreground",
                  )}
                />
                <span className="text-sm font-semibold">{opt.label}</span>
              </button>
            ))}
          </div>

          {role === "teacher" && (
            <p className="rounded-lg bg-primary/10 px-3 py-2 text-xs text-primary">
              ℹ️ Tu cuenta se crea como estudiante y se envía una{" "}
              <strong>solicitud de profesor</strong>. Un administrador debe
              aprobarla antes de darte acceso de profesor.
            </p>
          )}

          <div className="space-y-2">
            <Label htmlFor="fullName">Nombre completo</Label>
            <Input
              id="fullName"
              placeholder="Ana Pérez"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Correo</Label>
            <Input
              id="email"
              type="email"
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
              placeholder="Mínimo 6 caracteres"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              required
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
            {loading ? <Spinner className="size-4" /> : "Crear cuenta"}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          ¿Ya tienes cuenta?{" "}
          <Link to="/login" className="font-semibold text-primary">
            Inicia sesión
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
