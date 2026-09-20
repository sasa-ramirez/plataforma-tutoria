import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { GraduationCap, BookUser, Laptop, MailCheck, MailWarning } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { requestTeacherRole } from "@/services/admin";
import { suggestEmailDomain } from "@/lib/emailDomain";
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
  const [confirmEmail, setConfirmEmail] = useState("");
  // Correo que el usuario aceptó tal cual aunque el dominio parezca errado.
  const [acceptedAsIs, setAcceptedAsIs] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("student");
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const cleanEmail = email.trim().toLowerCase();
  const suggestion = suggestEmailDomain(cleanEmail);
  const showSuggestion = !!suggestion && acceptedAsIs !== cleanEmail;
  const mismatch =
    confirmEmail.trim() !== "" && confirmEmail.trim().toLowerCase() !== cleanEmail;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!accepted) {
      setError("Debes aceptar los Términos y la Política de Privacidad.");
      return;
    }
    if (confirmEmail.trim().toLowerCase() !== cleanEmail) {
      setError("Los dos correos no coinciden. Revísalos: a ese correo llegará tu confirmación.");
      return;
    }
    if (showSuggestion) {
      setError(`Revisa tu correo: ¿quisiste decir ${suggestion}? Elige una opción arriba para continuar.`);
      return;
    }
    setLoading(true);
    try {
      // El backend siempre crea estudiantes; el rol no lo decide el cliente.
      const { needsConfirmation } = await signUp({
        email: cleanEmail,
        password,
        fullName,
        role,
      });

      if (needsConfirmation) {
        // No hay sesión: hay que confirmar el correo antes de entrar.
        setSentTo(cleanEmail);
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
      toast("Correo reenviado", "success");
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
              ℹ️ Tu solicitud de profesor ya quedó registrada. Un administrador
              la revisará. Confirma tu correo para poder entrar.
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
            ¿No llega? Revisa Spam (y Cuarentena si usas correo institucional) o
            espera unos minutos. Si sigue sin llegar, pídele a tu coordinador que
            confirme tu cuenta.
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
          <div className="mb-3 grid size-14 place-items-center rounded-2xl gradient-brand text-white surface-glow">
            <Laptop className="size-7" />
          </div>
          <span className="mb-2 text-2xl font-extrabold tracking-tight text-gradient">
            Kódea
          </span>
          <h1 className="text-xl font-bold tracking-tight">
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
              autoComplete="email"
              required
            />
            {showSuggestion && (
              <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs">
                <p className="flex items-start gap-1.5 font-medium text-foreground">
                  <MailWarning className="mt-0.5 size-4 shrink-0 text-warning" />
                  <span>
                    ¿Quisiste decir <strong>{suggestion}</strong>? Con un correo mal
                    escrito no te llega la confirmación y no podrás entrar.
                  </span>
                </p>
                <div className="mt-2 flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="brand"
                    onClick={() => {
                      setEmail(suggestion!);
                      setConfirmEmail("");
                    }}
                  >
                    Sí, corregir
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setAcceptedAsIs(cleanEmail)}
                  >
                    No, está bien
                  </Button>
                </div>
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmEmail">Repite tu correo</Label>
            <Input
              id="confirmEmail"
              type="email"
              inputMode="email"
              placeholder="Escríbelo de nuevo"
              value={confirmEmail}
              onChange={(e) => setConfirmEmail(e.target.value)}
              // Se escribe a mano a propósito: pegar copiaría el mismo error.
              onPaste={(e) => e.preventDefault()}
              autoComplete="off"
              required
            />
            {mismatch && (
              <p className="text-xs text-destructive">Los correos no coinciden todavía.</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Contraseña</Label>
            <Input
              id="password"
              type="password"
              placeholder="Mínimo 8 caracteres"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
            />
          </div>

          {/* Aceptación de términos y privacidad */}
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-card/40 p-3">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
              className="mt-0.5 size-5 shrink-0 accent-primary"
            />
            <span className="text-xs leading-relaxed text-muted-foreground">
              Acepto los{" "}
              <Link
                to="/terms"
                target="_blank"
                className="font-semibold text-primary underline"
              >
                Términos y Condiciones
              </Link>{" "}
              y la{" "}
              <Link
                to="/privacy"
                target="_blank"
                className="font-semibold text-primary underline"
              >
                Política de Privacidad
              </Link>
              . Si soy menor de edad, cuento con autorización de mi tutor.
            </span>
          </label>

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
            disabled={loading || !accepted}
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
