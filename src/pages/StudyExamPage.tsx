import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, BarChart3, CheckCircle2, ClipboardCheck, Flag, Trophy, XCircle } from "lucide-react";
import { EmptyState } from "@/components/common/EmptyState";
import { FullScreenLoader, Spinner } from "@/components/common/Spinner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { useStudyExam, useAnswerExamQuestion, useFinishStudyExam } from "@/hooks/useStudy";
import type { StudyExam, StudyExamQuestion } from "@/services/study";
import { cn } from "@/lib/utils";

/** Resolver un parcial simulado y, al finalizar, repasar cada pregunta. */
export function StudyExamPage() {
  const { spaceId = "", examId = "" } = useParams();
  const { data, isLoading } = useStudyExam(examId);

  if (isLoading) return <FullScreenLoader />;
  if (!data) {
    return (
      <EmptyState
        icon={ClipboardCheck}
        title="Parcial no encontrado"
        description="Puede que lo hayas borrado."
        action={
          <Button asChild variant="brand">
            <Link to={`/app/study/${spaceId}`}>Volver a la materia</Link>
          </Button>
        }
      />
    );
  }
  return data.exam.status === "finished" ? (
    <ExamResult spaceId={spaceId} exam={data.exam} questions={data.questions} />
  ) : (
    <ExamRunner spaceId={spaceId} exam={data.exam} questions={data.questions} />
  );
}

function ExamRunner({
  spaceId,
  exam,
  questions,
}: {
  spaceId: string;
  exam: StudyExam;
  questions: StudyExamQuestion[];
}) {
  const { toast } = useToast();
  const { mutateAsync: answer } = useAnswerExamQuestion();
  const { mutateAsync: finish, isPending: finishing } = useFinishStudyExam(spaceId, exam.id);
  // Respuestas en pantalla al instante; el servidor se actualiza en segundo plano.
  const [picked, setPicked] = useState<Record<string, number>>(() =>
    Object.fromEntries(questions.filter((q) => q.selected !== null).map((q) => [q.id, q.selected as number])),
  );
  const [index, setIndex] = useState(() => {
    const firstOpen = questions.findIndex((q) => q.selected === null);
    return firstOpen === -1 ? 0 : firstOpen;
  });

  const q = questions[index];
  const answeredCount = Object.keys(picked).length;

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [index]);

  const choose = async (opt: number) => {
    const prev = picked[q.id];
    setPicked((p) => ({ ...p, [q.id]: opt }));
    try {
      await answer({ questionId: q.id, selected: opt });
    } catch (e) {
      setPicked((p) => {
        const n = { ...p };
        if (prev === undefined) delete n[q.id];
        else n[q.id] = prev;
        return n;
      });
      toast(e instanceof Error ? e.message : "No se guardó tu respuesta, intenta de nuevo", "error");
    }
  };

  const handleFinish = async () => {
    const missing = questions.length - answeredCount;
    const msg =
      missing > 0
        ? `Te faltan ${missing} pregunta${missing === 1 ? "" : "s"} sin responder (cuentan como incorrectas). ¿Finalizar igual?`
        : "¿Finalizar el parcial y ver tu resultado?";
    if (!window.confirm(msg)) return;
    try {
      await finish();
    } catch (e) {
      toast(e instanceof Error ? e.message : "No se pudo finalizar", "error");
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Link
          to={`/app/study/${spaceId}`}
          className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Salir (se guarda)
        </Link>
        <span className="text-xs font-semibold text-muted-foreground">
          {answeredCount}/{questions.length} respondidas
        </span>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{exam.title}</p>
        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${(answeredCount / questions.length) * 100}%` }}
          />
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={q.id}
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -12 }}
          transition={{ duration: 0.15 }}
        >
          <Card>
            <CardContent className="space-y-4 p-5">
              <p className="text-xs font-semibold text-muted-foreground">
                Pregunta {index + 1} de {questions.length}
              </p>
              <p className="text-base font-bold leading-snug">{q.question}</p>
              <div className="space-y-2">
                {q.options.map((opt, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => choose(i)}
                    className={cn(
                      "flex w-full items-start gap-3 rounded-xl border-2 p-3 text-left text-sm transition-colors",
                      picked[q.id] === i
                        ? "border-primary bg-primary/10 font-semibold"
                        : "border-border hover:border-primary/40",
                    )}
                  >
                    <span
                      className={cn(
                        "grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold",
                        picked[q.id] === i ? "bg-primary text-primary-foreground" : "bg-muted",
                      )}
                    >
                      {String.fromCharCode(65 + i)}
                    </span>
                    <span>{opt}</span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </AnimatePresence>

      <div className="flex items-center justify-between gap-2">
        <Button variant="outline" disabled={index === 0} onClick={() => setIndex((i) => i - 1)}>
          <ArrowLeft className="size-4" /> Anterior
        </Button>
        {index < questions.length - 1 ? (
          <Button variant="brand" onClick={() => setIndex((i) => i + 1)}>
            Siguiente <ArrowRight className="size-4" />
          </Button>
        ) : (
          <Button variant="brand" onClick={handleFinish} disabled={finishing}>
            {finishing ? <Spinner className="size-4" /> : <Flag className="size-4" />} Finalizar
          </Button>
        )}
      </div>

      {/* Mapa de preguntas */}
      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex flex-wrap gap-1.5">
            {questions.map((x, i) => (
              <button
                key={x.id}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Ir a la pregunta ${i + 1}`}
                className={cn(
                  "grid size-8 place-items-center rounded-lg text-xs font-bold transition-colors",
                  i === index
                    ? "bg-primary text-primary-foreground"
                    : picked[x.id] !== undefined
                      ? "bg-primary/15 text-primary"
                      : "bg-muted text-muted-foreground",
                )}
              >
                {i + 1}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" className="w-full" onClick={handleFinish} disabled={finishing}>
            <Flag className="size-4" /> Finalizar parcial
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function ExamResult({
  spaceId,
  exam,
  questions,
}: {
  spaceId: string;
  exam: StudyExam;
  questions: StudyExamQuestion[];
}) {
  const [onlyWrong, setOnlyWrong] = useState(false);
  const correct = exam.correct_count ?? questions.filter((q) => q.selected === q.correct).length;
  const total = questions.length;
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
  const shown = useMemo(
    () => (onlyWrong ? questions.filter((q) => q.selected !== q.correct) : questions),
    [onlyWrong, questions],
  );
  const tone = pct >= 70 ? "text-success" : pct >= 50 ? "text-warning" : "text-destructive";

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link
        to={`/app/study/${spaceId}`}
        className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Volver a la materia
      </Link>

      <Card>
        <CardContent className="flex flex-col items-center gap-1 p-6 text-center">
          <Trophy className={cn("size-9", tone)} />
          <p className={cn("text-4xl font-extrabold", tone)}>{pct}%</p>
          <p className="text-sm text-muted-foreground">
            {correct} de {total} correctas · {exam.title}
          </p>
        </CardContent>
      </Card>

      <Button asChild variant="brand" className="w-full">
        <Link to={`/app/study/${spaceId}/report`}>
          <BarChart3 className="size-4" /> Ver mi informe de falencias
        </Link>
      </Button>

      <div className="flex items-center justify-between gap-2">
        <h2 className="font-bold">Repaso</h2>
        <Button variant="ghost" size="sm" onClick={() => setOnlyWrong((v) => !v)}>
          {onlyWrong ? "Ver todas" : "Solo las falladas"}
        </Button>
      </div>

      {shown.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">¡No fallaste ninguna! 🎉</p>
      ) : (
        shown.map((q) => {
          const ok = q.selected === q.correct;
          return (
            <Card key={q.id}>
              <CardContent className="space-y-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-bold leading-snug">
                    {q.position}. {q.question}
                  </p>
                  {ok ? (
                    <CheckCircle2 className="size-5 shrink-0 text-success" />
                  ) : (
                    <XCircle className="size-5 shrink-0 text-destructive" />
                  )}
                </div>
                <Badge variant="secondary">{q.topic}</Badge>
                <div className="space-y-1">
                  {q.options.map((opt, i) => (
                    <p
                      key={i}
                      className={cn(
                        "rounded-lg px-2.5 py-1.5 text-xs",
                        i === q.correct && "bg-success/10 font-semibold text-success",
                        i === q.selected && i !== q.correct && "bg-destructive/10 font-semibold text-destructive",
                      )}
                    >
                      {String.fromCharCode(65 + i)}. {opt}
                      {i === q.correct && " ✓"}
                      {i === q.selected && i !== q.correct && " (tu respuesta)"}
                    </p>
                  ))}
                  {q.selected === null && (
                    <p className="text-xs italic text-muted-foreground">Sin responder</p>
                  )}
                </div>
                {q.explanation && (
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    <span className="font-semibold text-foreground">Por qué: </span>
                    {q.explanation}
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}
