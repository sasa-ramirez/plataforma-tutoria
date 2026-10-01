import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { BarChart3, Copy, Crown, Medal, Play, ShieldAlert, SkipForward, Square, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/common/Spinner";
import { useToast } from "@/components/ui/toast";
import { useQuizParticipants, useStartQuiz, useNextQuizQuestion, useEndQuiz } from "@/hooks/useQuiz";
import { makeQrDataUrl } from "@/lib/qr";
import { cn } from "@/lib/utils";
import type { Exercise, QuizSession } from "@/types/database";

const MEDAL_COLOR = ["text-warning", "text-muted-foreground", "text-orange-700"];

export function QuizHostView({
  session,
  questions,
  title,
}: {
  session: QuizSession;
  questions: Exercise[];
  title: string;
}) {
  const { toast } = useToast();
  const { data: participants, isLoading } = useQuizParticipants(session.id);
  const { mutateAsync: start, isPending: starting } = useStartQuiz();
  const { mutateAsync: next, isPending: advancing } = useNextQuizQuestion();
  const { mutateAsync: end, isPending: ending } = useEndQuiz();
  const [qr, setQr] = useState<string | null>(null);

  const joinUrl = `${window.location.origin}/app/quiz/${session.id}`;

  useEffect(() => {
    if (session.status !== "lobby") return;
    let active = true;
    makeQrDataUrl(joinUrl).then((url) => active && setQr(url));
    return () => {
      active = false;
    };
  }, [session.status, joinUrl]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(joinUrl);
      toast("Enlace copiado", "success");
    } catch {
      toast("No se pudo copiar", "error");
    }
  };

  const currentQuestion = session.mode === "sync" ? questions[session.current_index] : null;

  const handleStart = async () => {
    try {
      await start(session.id);
    } catch (e) {
      toast(e instanceof Error ? e.message : "No se pudo iniciar", "error");
    }
  };
  const handleNext = async () => {
    try {
      await next(session.id);
    } catch (e) {
      toast(e instanceof Error ? e.message : "No se pudo avanzar", "error");
    }
  };
  const handleEnd = async () => {
    if (!window.confirm("¿Terminar el quiz ahora?")) return;
    try {
      await end(session.id);
    } catch (e) {
      toast(e instanceof Error ? e.message : "No se pudo terminar", "error");
    }
  };

  return (
    <div className="mx-auto max-w-xl space-y-4 p-4">
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Quiz en vivo · {session.mode === "sync" ? "al mismo tiempo" : "a su ritmo"}
        </p>
        <h1 className="text-xl font-extrabold">{title}</h1>
      </div>

      {session.status === "lobby" && (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 p-6 text-center">
            <p className="text-sm text-muted-foreground">
              Tus estudiantes escanean este código (o entran con el enlace) para unirse.
            </p>
            {qr ? (
              <img src={qr} alt="Código QR para unirse" className="size-56 rounded-xl border" />
            ) : (
              <Skeleton className="size-56 rounded-xl" />
            )}
            <button
              onClick={copyLink}
              className="flex items-center gap-1.5 rounded-lg bg-muted px-3 py-1.5 font-mono text-xs"
            >
              {joinUrl.replace(/^https?:\/\//, "")} <Copy className="size-3.5" />
            </button>
            <div className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
              <Users className="size-4" /> {participants?.length ?? 0} en la sala
            </div>
            <Button
              variant="brand"
              size="lg"
              className="w-full"
              onClick={handleStart}
              disabled={starting || !participants?.length}
            >
              {starting ? <Spinner className="size-4" /> : <Play className="size-4" />}
              Comenzar
            </Button>
            {!participants?.length && (
              <p className="text-xs text-muted-foreground">
                Espera a que se una al menos un estudiante.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {session.status === "active" && (
        <>
          {session.mode === "sync" && currentQuestion && (
            <Card>
              <CardContent className="space-y-3 p-5">
                <p className="text-xs font-semibold text-muted-foreground">
                  Pregunta {session.current_index + 1} de {questions.length}
                </p>
                {session.shuffle && (
                  <p className="flex items-center gap-1.5 rounded-lg bg-warning/10 px-2.5 py-1.5 text-[11px] font-medium text-warning">
                    <ShieldAlert className="size-3.5 shrink-0" />
                    Orden aleatorio activado: esta es tu referencia, cada
                    estudiante puede estar viendo una pregunta distinta en
                    este momento.
                  </p>
                )}
                <p className="text-lg font-bold">{currentQuestion.title}</p>
                <p className="text-sm text-muted-foreground">{currentQuestion.prompt}</p>
                <div className="grid grid-cols-2 gap-2">
                  {currentQuestion.options.map((opt, i) => (
                    <div
                      key={i}
                      className="rounded-lg border bg-muted/40 px-3 py-2 text-sm font-medium"
                    >
                      {String.fromCharCode(65 + i)}. {opt}
                    </div>
                  ))}
                </div>
                <Button
                  variant="brand"
                  className="w-full"
                  onClick={handleNext}
                  disabled={advancing}
                >
                  {advancing ? (
                    <Spinner className="size-4" />
                  ) : (
                    <SkipForward className="size-4" />
                  )}
                  {session.current_index + 1 >= questions.length
                    ? "Terminar con esta pregunta"
                    : "Siguiente pregunta"}
                </Button>
              </CardContent>
            </Card>
          )}
          {session.mode === "pace" && (
            <Card>
              <CardContent className="space-y-3 p-5 text-center">
                <p className="text-sm text-muted-foreground">
                  Cada estudiante va a su ritmo — no hace falta que avances nada.
                  Termínalo cuando quieras.
                </p>
                <Button
                  variant="outline"
                  className="w-full text-destructive hover:bg-destructive/10"
                  onClick={handleEnd}
                  disabled={ending}
                >
                  {ending ? <Spinner className="size-4" /> : <Square className="size-4" />}
                  Terminar quiz
                </Button>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {session.status === "ended" && (
        <Card className="border-success/30 bg-success/5">
          <CardContent className="space-y-3 p-5 text-center">
            <p className="text-sm font-semibold text-success">Quiz terminado</p>
            <Button asChild variant="outline" className="w-full">
              <Link to={`/app/quiz/${session.id}/results`}>
                <BarChart3 className="size-4" /> Ver resultados completos
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="space-y-1.5 p-4">
          <p className="mb-1 flex items-center gap-1.5 text-sm font-bold text-muted-foreground">
            <Crown className="size-4" /> Marcador
          </p>
          {isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : !participants || participants.length === 0 ? (
            <p className="py-3 text-center text-xs text-muted-foreground">
              Nadie se ha unido todavía.
            </p>
          ) : (
            <AnimatePresence initial={false}>
              {participants.map((p, i) => (
                <motion.div
                  key={p.id}
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center gap-3 rounded-lg px-2 py-2"
                >
                  <span
                    className={cn(
                      "w-5 shrink-0 text-center text-xs font-bold",
                      i < 3 ? MEDAL_COLOR[i] : "text-muted-foreground",
                    )}
                  >
                    {i < 3 ? <Medal className="size-4" /> : i + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                    {p.full_name ?? "Estudiante"}
                  </span>
                  <span className="shrink-0 text-sm font-bold text-primary">{p.score}</span>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </CardContent>
      </Card>

      <Button asChild variant="ghost" className="w-full">
        <Link to={`/app/courses`}>Salir</Link>
      </Button>
    </div>
  );
}
