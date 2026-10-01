import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Clock, PartyPopper, Trophy, XCircle } from "lucide-react";
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
import { seededShuffleIndices } from "@/lib/shuffle";
import { cn } from "@/lib/utils";
import type { Exercise, QuizSession } from "@/types/database";

const OPTION_STYLES = [
  "bg-[#22c1a4]",
  "bg-[#e0553d]",
  "bg-[#3b82f6]",
  "bg-[#f0b429]",
];

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
  const { profile } = useAuth();
  const { data: participants } = useQuizParticipants(session.id);
  const { mutateAsync: join } = useJoinQuiz();
  const { mutateAsync: submit, isPending: submitting } = useSubmitQuizAnswer();
  const [feedback, setFeedback] = useState<{ correct: boolean; forIndex: number } | null>(null);
  // Se espera a que termine de unirse antes de mostrar preguntas: si el
  // quiz ya estaba activo al entrar, respondería antes de existir como
  // participante y la entrega fallaría.
  const [joined, setJoined] = useState(false);

  useEffect(() => {
    let active = true;
    join(session.id)
      .then(() => active && setJoined(true))
      .catch((e) => {
        if (!active) return;
        toast(e instanceof Error ? e.message : "No se pudo unir al quiz", "error");
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.id]);

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

  const answer = async (selected: number) => {
    if (!question) return;
    try {
      const result = await submit({ sessionId: session.id, exerciseId: question.id, selected });
      setFeedback({ correct: result.correct, forIndex: questionIndex });
    } catch (e) {
      toast(e instanceof Error ? e.message : "No se pudo enviar tu respuesta", "error");
    }
  };

  if (!joined || session.status === "lobby") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
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

  if (session.status === "ended" || finished) {
    return (
      <div className="mx-auto flex min-h-screen max-w-sm flex-col items-center gap-4 p-6 pb-10 text-center">
        <PartyPopper className="mt-6 size-12 text-primary" />
        <p className="text-xl font-extrabold">
          {session.status === "ended" ? "¡Quiz terminado!" : "¡Ya respondiste todo!"}
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
      <div className="mb-3 flex items-center justify-between text-xs font-semibold text-muted-foreground">
        <span>
          Pregunta {questionIndex + 1} de {questions.length}
        </span>
        {me && <span>{me.score} pts</span>}
      </div>

      <Card className="mb-4">
        <CardContent className="p-5">
          <p className="text-lg font-bold">{question.title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{question.prompt}</p>
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
                disabled={submitting}
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
