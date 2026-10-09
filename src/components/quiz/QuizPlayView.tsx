import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  Clock,
  PartyPopper,
  TriangleAlert,
  Trophy,
  WifiOff,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/common/Spinner";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/context/AuthContext";
import {
  useQuizParticipants,
  useJoinQuiz,
  useSubmitQuizAnswer,
  useQuizParticipantDetail,
} from "@/hooks/useQuiz";
import { logQuizEvent, quizHeartbeat } from "@/services/quiz";
import { seededShuffleIndices } from "@/lib/shuffle";
import { splitQuestion } from "@/lib/quizText";
import { fmtDeadline, isExpired } from "@/lib/quizSession";
import { cn } from "@/lib/utils";
import type { Exercise, QuizSession } from "@/types/database";

const OPTION_STYLES = [
  "bg-[#22c1a4]",
  "bg-[#e0553d]",
  "bg-[#3b82f6]",
  "bg-[#f0b429]",
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Errores "de reglas" del servidor: reintentar no los arregla. Todo lo
 * demás (red caída, timeout) sí merece reintento automático. */
const RULE_ERROR = /(no autorizado|ya termin|ya cerr|no encontrada|no está activo|no es la pregunta|ya respondiste|en orden|no válida)/i;

/** true/false según el celular tenga o no conexión (con su aviso en vivo). */
function useOnline() {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}

export function QuizPlayView({
  session,
  questions,
  questionsById,
  title,
}: {
  session: QuizSession;
  questions: Exercise[];
  questionsById: Record<string, Exercise>;
  title: string;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { profile } = useAuth();
  const { data: participants } = useQuizParticipants(session.id);
  const { mutateAsync: join } = useJoinQuiz();
  const { mutateAsync: submit } = useSubmitQuizAnswer();
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<{ correct: boolean; forIndex: number } | null>(null);
  // Se espera a que termine de unirse antes de mostrar preguntas: si el
  // quiz ya estaba activo al entrar, respondería antes de existir como
  // participante y la entrega fallaría.
  const [joinState, setJoinState] = useState<"joining" | "joined" | "error">("joining");
  const [joinError, setJoinError] = useState("");
  const [joinTry, setJoinTry] = useState(0);
  const joined = joinState === "joined";
  const online = useOnline();
  // Tarea abierta con hora de cierre: se revisa cada 20 s para pasar a la pantalla final
  // sin que el estudiante tenga que recargar (el servidor ya impide responder).
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!session.closes_at) return;
    const t = setInterval(() => setNow(Date.now()), 20_000);
    return () => clearInterval(t);
  }, [session.closes_at]);
  const expired = isExpired(session, now);
  const offlineSince = useRef<number | null>(null);

  // Unirse con reintentos automáticos (1, 2, 4, 8 s). Antes un solo fallo
  // de red dejaba al estudiante mirando "ya estás dentro" sin estarlo.
  useEffect(() => {
    let active = true;
    setJoinState("joining");
    (async () => {
      for (let i = 0; i < 5; i++) {
        try {
          await join(session.id);
          if (active) setJoinState("joined");
          return;
        } catch (e) {
          if (!active) return;
          const msg = e instanceof Error ? e.message : "";
          if (RULE_ERROR.test(msg) || i === 4) {
            setJoinError(msg || "No se pudo conectar con el quiz.");
            setJoinState("error");
            void logQuizEvent(session.id, "error", { where: "join", message: msg });
            return;
          }
          await sleep(1000 * 2 ** i);
        }
      }
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.id, joinTry]);

  // Latido cada 20 s para que el profe vea quién perdió señal, y al volver
  // a la pantalla / recuperar internet se re-une (es idempotente) y se
  // refresca el estado: así nadie se queda "congelado" tras una desconexión.
  useEffect(() => {
    if (!joined || session.status === "ended" || expired) return;
    const beat = () => {
      if (document.visibilityState === "visible" && navigator.onLine) {
        quizHeartbeat(session.id).catch(() => {});
      }
    };
    const comeBack = () => {
      if (document.visibilityState !== "visible" || !navigator.onLine) return;
      join(session.id).catch(() => {});
      qc.invalidateQueries({ queryKey: ["quiz", "session", session.id] });
      qc.invalidateQueries({ queryKey: ["quiz", "participants", session.id] });
    };
    beat();
    const timer = setInterval(beat, 20_000);
    window.addEventListener("online", comeBack);
    document.addEventListener("visibilitychange", comeBack);
    return () => {
      clearInterval(timer);
      window.removeEventListener("online", comeBack);
      document.removeEventListener("visibilitychange", comeBack);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [joined, session.id, session.status]);

  // Anota cuánto tiempo estuvo sin conexión (se manda al volver).
  useEffect(() => {
    if (!online) {
      offlineSince.current = Date.now();
    } else if (offlineSince.current) {
      const seconds = Math.round((Date.now() - offlineSince.current) / 1000);
      offlineSince.current = null;
      void logQuizEvent(session.id, "offline", { seconds });
    }
  }, [online, session.id]);

  const me = participants?.find((p) => p.student_id === profile?.id) ?? null;
  const myRank = participants ? participants.findIndex((p) => p.student_id === profile?.id) : -1;

  const questionIndex = session.mode === "sync" ? session.current_index : (me?.current_index ?? 0);
  // Con orden al azar, "mi" pregunta en esta posición se busca en mi propio
  // orden (guardado al unirme); sin shuffle, es el orden canónico de siempre.
  const myOrder = session.shuffle ? (me?.question_order ?? null) : questions.map((q) => q.id);
  const question = myOrder ? questionsById[myOrder[questionIndex]] : undefined;
  const showFeedback = feedback?.forIndex === questionIndex;
  // En sync, ya respondió si su avance pasó la pregunta activa; en pace, es
  // lo mismo por construcción (avanza justo al responder). El feedback local
  // también cuenta, para no mostrar las opciones otra vez mientras llega la
  // confirmación en vivo (hay un pequeño retraso de red entre enviar y que
  // el marcador se actualice).
  const alreadyAnswered = (!!me && me.current_index > questionIndex) || showFeedback;
  const finished = session.mode === "pace" && !!me && me.current_index >= questions.length;

  // Opciones mezcladas de forma estable por estudiante+pregunta (mismo orden
  // siempre, para no "saltar" al recargar). optionOrder[posiciónMostrada] =
  // índice original — se manda el original al calificar, nunca el mostrado.
  const optionOrder = useMemo(
    () =>
      question
        ? seededShuffleIndices(`${profile?.id ?? ""}:${question.id}`, question.options.length)
        : [],
    [profile?.id, question],
  );

  // Envía la respuesta con reintentos si falla la red (1, 2, 4 s). Si el
  // servidor ya la tenía ("ya respondiste": la primera llegó pero se perdió
  // la confirmación) o la pregunta cambió, solo se re-sincroniza.
  const answer = async (selected: number) => {
    if (!question || sending) return;
    setSending(true);
    try {
      for (let i = 0; i < 4; i++) {
        try {
          const result = await submit({
            sessionId: session.id,
            exerciseId: question.id,
            selected,
          });
          setFeedback({ correct: result.correct, forIndex: questionIndex });
          return;
        } catch (e) {
          const msg = e instanceof Error ? e.message : "";
          if (/ya respondiste/i.test(msg)) {
            qc.invalidateQueries({ queryKey: ["quiz", "participants", session.id] });
            return;
          }
          if (RULE_ERROR.test(msg)) {
            qc.invalidateQueries({ queryKey: ["quiz", "session", session.id] });
            qc.invalidateQueries({ queryKey: ["quiz", "participants", session.id] });
            toast(msg, "error");
            return;
          }
          if (i === 3) {
            void logQuizEvent(session.id, "error", { where: "submit", message: msg });
            toast("No se pudo enviar. Revisa tu conexión y toca tu respuesta de nuevo.", "error");
            return;
          }
          await sleep(1000 * 2 ** i);
        }
      }
    } finally {
      setSending(false);
    }
  };

  if (joinState === "error") {
    const ended = /ya (termin|cerr)/i.test(joinError);
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <TriangleAlert className="size-10 text-warning" />
        <div>
          <p className="text-lg font-bold">{title}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {ended
              ? /cerr/i.test(joinError)
                ? "El plazo de este quiz ya cerró."
                : "Este quiz ya terminó."
              : `No pudimos meterte al quiz. ${joinError}`}
          </p>
        </div>
        {!ended && (
          <Button variant="brand" onClick={() => setJoinTry((n) => n + 1)}>
            Reintentar
          </Button>
        )}
        <Link to="/app" className="text-sm font-semibold text-primary">
          Volver al inicio
        </Link>
      </div>
    );
  }

  if (!joined) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <Spinner className="size-8 text-primary" />
        <div>
          <p className="text-lg font-bold">{title}</p>
          <p className="text-sm text-muted-foreground">Entrando al quiz…</p>
        </div>
      </div>
    );
  }

  if (session.status === "lobby") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <OfflineBanner online={online} />
        <Spinner className="size-8 text-primary" />
        <div>
          <p className="text-lg font-bold">{title}</p>
          <p className="text-sm text-muted-foreground">
            Ya estás dentro. Esperando a que tu tutor comience…
          </p>
        </div>
      </div>
    );
  }

  if (session.status === "ended" || expired || finished) {
    return (
      <div className="mx-auto flex min-h-screen max-w-sm flex-col items-center gap-4 p-6 pb-10 text-center">
        <PartyPopper className="mt-6 size-12 text-primary" />
        <p className="text-xl font-extrabold">
          {session.status === "ended" || expired ? "¡Quiz terminado!" : "¡Ya respondiste todo!"}
        </p>
        {me && (
          <div className="w-full space-y-1 rounded-2xl border bg-card p-5">
            <p className="text-3xl font-extrabold text-primary">{me.score}</p>
            <p className="text-xs text-muted-foreground">puntos</p>
            {myRank >= 0 && (
              <p className="flex items-center justify-center gap-1.5 text-sm font-semibold text-muted-foreground">
                <Trophy className="size-4" /> Puesto {myRank + 1} de {participants?.length}
              </p>
            )}
          </div>
        )}
        {session.status === "active" && finished && (
          <p className="text-xs text-muted-foreground">
            Esperando a que tu tutor cierre el quiz…
          </p>
        )}
        <MyAnswersReview participantId={me?.id} />
        <Link to="/app" className="text-sm font-semibold text-primary">
          Volver al inicio
        </Link>
      </div>
    );
  }

  if (!question) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-center text-sm text-muted-foreground">
        <Skeleton className="h-40 w-full max-w-sm" />
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col p-4">
      <OfflineBanner online={online} />
      <div className="mb-3 flex items-center justify-between text-xs font-semibold text-muted-foreground">
        <span>
          Pregunta {questionIndex + 1} de {questions.length}
          {session.closes_at && <span className="ml-2 font-normal">· cierra {fmtDeadline(session.closes_at)}</span>}
        </span>
        {me && <span>{me.score} pts</span>}
      </div>

      <Card className="mb-4">
        <CardContent className="p-5">
          {(() => {
            const { heading, body } = splitQuestion(question);
            return heading ? (
              <>
                <p className="text-lg font-bold">{heading}</p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{body}</p>
              </>
            ) : (
              <p className="whitespace-pre-wrap text-lg font-bold">{body}</p>
            );
          })()}
        </CardContent>
      </Card>

      <AnimatePresence mode="wait">
        {alreadyAnswered ? (
          <motion.div
            key="waiting"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-1 flex-col items-center justify-center gap-3 text-center"
          >
            {showFeedback ? (
              feedback!.correct ? (
                <CheckCircle2 className="size-14 text-success" />
              ) : (
                <XCircle className="size-14 text-destructive" />
              )
            ) : (
              <Clock className="size-14 text-muted-foreground" />
            )}
            <p className="font-semibold">
              {showFeedback
                ? feedback!.correct
                  ? "¡Correcto!"
                  : "No era esa, sigue así"
                : "Respuesta enviada"}
            </p>
            <p className="text-xs text-muted-foreground">
              {session.mode === "sync"
                ? "Esperando a que tu tutor pase la siguiente…"
                : "Cargando la siguiente pregunta…"}
            </p>
          </motion.div>
        ) : (
          <motion.div
            key="options"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid flex-1 grid-cols-1 gap-2.5 content-start"
          >
            {optionOrder.map((origIdx, i) => (
              <button
                key={origIdx}
                type="button"
                disabled={sending}
                onClick={() => answer(origIdx)}
                className={cn(
                  "flex items-center gap-3 rounded-2xl px-4 py-4 text-left text-base font-semibold text-white shadow-sm transition-transform active:scale-[0.98] disabled:opacity-60",
                  OPTION_STYLES[i % OPTION_STYLES.length],
                )}
              >
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-white/25 text-sm">
                  {String.fromCharCode(65 + i)}
                </span>
                {question.options[origIdx]}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Aviso fijo cuando el celular pierde internet: lo que ya se respondió
 * está a salvo en el servidor y el quiz sigue donde iba al volver la señal. */
function OfflineBanner({ online }: { online: boolean }) {
  if (online) return null;
  return (
    <div className="fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-2 bg-warning px-3 py-2 text-xs font-semibold text-black">
      <WifiOff className="size-4" />
      Sin conexión. Tu avance está guardado; sigue cuando vuelva la señal.
    </div>
  );
}

/** Repaso pregunta por pregunta en la pantalla final: qué respondiste y cuál era la correcta. */
function MyAnswersReview({ participantId }: { participantId: string | undefined }) {
  const [open, setOpen] = useState(false);
  const { data: answers, isLoading } = useQuizParticipantDetail(participantId, open);

  if (!participantId) return null;

  return (
    <div className="w-full text-left">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full rounded-xl border px-4 py-2.5 text-center text-sm font-semibold text-primary hover:bg-primary/5"
      >
        {open ? "Ocultar repaso" : "Ver mis respuestas"}
      </button>
      {open && (
        <div className="mt-3 space-y-2">
          {isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            (answers ?? []).map((a) => (
              <div key={a.exercise_id} className="rounded-xl border bg-card p-3">
                <p className="text-sm font-semibold">{a.title}</p>
                <div className="mt-1.5 flex items-start gap-2 text-xs">
                  {a.is_correct ? (
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
                  ) : (
                    <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
                  )}
                  <div className="space-y-0.5">
                    <p className={a.is_correct ? "text-success" : "text-destructive"}>
                      Tu respuesta: {a.options[a.selected] ?? "—"}
                    </p>
                    {!a.is_correct && (
                      <p className="text-muted-foreground">
                        Correcta: {a.options[a.correct_index] ?? "—"}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
