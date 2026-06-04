import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, BookOpen, Eye, Sparkles, Timer, Lock } from "lucide-react";
import { useExercise, useAssignment } from "@/hooks/useAssignments";
import { useExamGuard } from "@/hooks/useExamGuard";
import { useToast } from "@/components/ui/toast";
import { CodeEditor } from "@/components/editor/CodeEditor";
import { CodeRunner } from "@/components/editor/CodeRunner";
import { AIFeedbackPanel } from "@/components/ai/AIFeedbackPanel";
import { ExamModeBanner } from "@/components/exam/ExamModeBanner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FullScreenLoader, Spinner } from "@/components/common/Spinner";
import { LANGUAGE_META, DIFFICULTY_META } from "@/lib/constants";
import { isAssignmentOpen } from "@/lib/utils";
import {
  getOrCreateDraft,
  saveDraft,
  submitForReview,
  fetchFeedback,
} from "@/services/submissions";
import type { AIFeedback, Submission } from "@/types/database";

export function SolvePage() {
  const { exerciseId = "" } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const { data: exercise, isLoading } = useExercise(exerciseId);
  const { data: assignment } = useAssignment(exercise?.assignment_id ?? "");

  const [submission, setSubmission] = useState<Submission | null>(null);
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<AIFeedback | null>(null);
  const [showSolution, setShowSolution] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isExam = !!assignment?.is_exam;

  const { exitCount, pasteCount } = useExamGuard({
    submissionId: submission?.id ?? null,
    enabled: isExam,
    onWarning: (event) => {
      if (event === "window_hidden")
        toast("⚠️ Saliste de la pantalla. Quedó registrado.", "error");
      if (event === "paste")
        toast("⚠️ Pegado detectado. Quedó registrado.", "error");
    },
  });

  // Inicializa borrador
  useEffect(() => {
    if (!exercise) return;
    let active = true;
    getOrCreateDraft(exercise.id, exercise.language, exercise.starter_code)
      .then(async (sub) => {
        if (!active) return;
        setSubmission(sub);
        setCode(sub.code);
        if (sub.status === "graded") {
          const fb = await fetchFeedback(sub.id);
          if (active) setFeedback(fb);
        }
      })
      .catch((e) => toast(e.message ?? "Error al cargar", "error"));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercise?.id]);

  // Autoguardado de borrador (debounced)
  const handleChange = useCallback(
    (value: string) => {
      setCode(value);
      if (!submission || submission.status !== "draft") return;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        saveDraft(submission.id, value).catch(() => {});
      }, 1000);
    },
    [submission],
  );

  const handleSubmit = useCallback(async () => {
    if (!submission) return;
    setSubmitting(true);
    setFeedback(null);
    try {
      const result = await submitForReview(submission.id, code);
      if (result.ok && result.feedback) {
        setFeedback(result.feedback as AIFeedback);
        setSubmission((s) => (s ? { ...s, status: "graded" } : s));
        toast(`¡Calificado! ${result.score}/100`, "success");
      } else {
        toast(result.error ?? "La IA no pudo revisar", "error");
        setSubmission((s) => (s ? { ...s, status: "draft" } : s));
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : "Error al enviar", "error");
    } finally {
      setSubmitting(false);
    }
  }, [submission, code, toast]);

  const handleReset = useCallback(() => {
    if (exercise) setCode(exercise.starter_code);
  }, [exercise]);

  // ----- Cronómetro: límite de tiempo y/o fecha de cierre -----
  const deadlineMs = useMemo(() => {
    if (!assignment) return null;
    const c: number[] = [];
    if (assignment.closes_at) c.push(new Date(assignment.closes_at).getTime());
    if (assignment.time_limit_min && submission?.started_at) {
      c.push(
        new Date(submission.started_at).getTime() +
          assignment.time_limit_min * 60_000,
      );
    }
    return c.length ? Math.min(...c) : null;
  }, [assignment, submission?.started_at]);

  const [clockNow, setClockNow] = useState(Date.now());
  useEffect(() => {
    if (!deadlineMs) return;
    const t = setInterval(() => setClockNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [deadlineMs]);

  const remainingMs = deadlineMs ? deadlineMs - clockNow : null;
  const timeUp = remainingMs !== null && remainingMs <= 0;
  const closedByDate =
    !!assignment && !isAssignmentOpen(assignment);
  const locked = timeUp || closedByDate;

  // Auto-envío al agotarse el tiempo (una sola vez)
  const autoSent = useRef(false);
  useEffect(() => {
    if (
      timeUp &&
      !autoSent.current &&
      submission &&
      submission.status !== "graded" &&
      !submitting
    ) {
      autoSent.current = true;
      toast("⏰ ¡Tiempo agotado! Enviando tu trabajo…", "info");
      handleSubmit();
    }
  }, [timeUp, submission, submitting, handleSubmit, toast]);

  if (isLoading) return <FullScreenLoader />;
  if (!exercise)
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-center text-muted-foreground">
        Ejercicio no encontrado.
      </div>
    );

  const lang = LANGUAGE_META[exercise.language];
  const diff = DIFFICULTY_META[exercise.difficulty];
  const graded = submission?.status === "graded";

  return (
    <div className="min-h-screen bg-background">
      {/* Header sticky */}
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b bg-background/90 px-4 py-3 backdrop-blur">
        <Button
          variant="ghost"
          size="icon"
          className="size-9"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="size-5" />
        </Button>
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold">{exercise.title}</p>
          <p className="text-xs text-muted-foreground">{lang.label}</p>
        </div>
        {remainingMs !== null && (
          <Badge
            variant={remainingMs < 60_000 ? "destructive" : "warning"}
            className={remainingMs < 60_000 ? "glow-pulse" : ""}
          >
            <Timer className="mr-1 size-3" />
            {(() => {
              const s = Math.max(0, Math.floor(remainingMs / 1000));
              return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
            })()}
          </Badge>
        )}
        <Badge className={diff.className}>{diff.label}</Badge>
      </header>

      <div className="mx-auto max-w-3xl space-y-4 p-4">
        {isExam && (
          <ExamModeBanner exitCount={exitCount} pasteCount={pasteCount} />
        )}

        {/* Enunciado */}
        <Card>
          <CardContent className="p-4">
            <div className="mb-1.5 flex items-center gap-1.5 text-sm font-bold">
              <BookOpen className="size-4 text-primary" /> Enunciado
            </div>
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">
              {exercise.prompt}
            </p>
          </CardContent>
        </Card>

        {/* Aviso de bloqueo */}
        {locked && (
          <div className="flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm font-medium text-destructive">
            <Lock className="size-5 shrink-0" />
            {timeUp
              ? "Se acabó el tiempo. Tu trabajo se envió automáticamente."
              : "Esta tarea está cerrada. Ya no puedes enviar."}
          </div>
        )}

        {/* Editor */}
        <CodeEditor
          value={code}
          onChange={handleChange}
          language={exercise.language}
          submitting={submitting}
          readOnly={locked}
          onSubmit={locked ? undefined : handleSubmit}
          onReset={locked ? undefined : handleReset}
        />

        {/* Ejecutar (Python/Java) — pruébalo antes de enviar */}
        <CodeRunner language={exercise.language} code={code} />

        {/* Estado de revisión */}
        <AnimatePresence mode="wait">
          {submitting && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center justify-center gap-2 rounded-xl border bg-card py-6 text-sm text-muted-foreground"
            >
              <Spinner className="size-4" />
              <span className="flex items-center gap-1">
                <Sparkles className="size-4 text-primary" /> La IA está
                revisando tu código…
              </span>
            </motion.div>
          )}
          {feedback && !submitting && (
            <motion.div key="fb">
              <AIFeedbackPanel feedback={feedback} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Solución (tras calificar) */}
        {graded && exercise.solution_code && (
          <div>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setShowSolution((v) => !v)}
            >
              <Eye className="size-4" />
              {showSolution ? "Ocultar solución" : "Ver solución"}
            </Button>
            <AnimatePresence>
              {showSolution && (
                <motion.pre
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-3 overflow-x-auto rounded-xl bg-[#0e0d1a] p-4 font-mono text-xs text-white/90"
                >
                  {exercise.solution_code}
                </motion.pre>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
