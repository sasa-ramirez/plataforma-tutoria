import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, BookOpen, CheckCircle2, XCircle, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/common/Spinner";
import { MathText } from "@/components/common/MathText";
import { useToast } from "@/components/ui/toast";
import { submitAnswer, type GradeResult } from "@/services/assignments";
import { DIFFICULTY_META } from "@/lib/constants";
import { isAssignmentOpen, cn } from "@/lib/utils";
import type { Assignment, Exercise } from "@/types/database";

/** Resolución de ejercicios NO-código: opción múltiple y numérica. */
export function AnswerExercise({
  exercise,
  assignment,
}: {
  exercise: Exercise;
  assignment?: Assignment | null;
}) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [selected, setSelected] = useState<number | null>(null);
  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<GradeResult | null>(null);

  const diff = DIFFICULTY_META[exercise.difficulty];
  const locked = !!assignment && !isAssignmentOpen(assignment);

  const canSubmit =
    exercise.type === "multiple_choice" ? selected !== null : value.trim() !== "";

  const submit = async () => {
    setSubmitting(true);
    setResult(null);
    try {
      const answer =
        exercise.type === "multiple_choice"
          ? { selected: String(selected) }
          : { value: Number(value) };
      const r = await submitAnswer(exercise.id, answer);
      setResult(r);
      toast(r.correct ? "¡Correcto! 🎉" : "Respuesta enviada", r.correct ? "success" : "info");
    } catch (e) {
      toast(e instanceof Error ? e.message : "No se pudo enviar", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b bg-background/90 px-4 py-3 backdrop-blur">
        <Button variant="ghost" size="icon" className="size-9" onClick={() => navigate(-1)}>
          <ArrowLeft className="size-5" />
        </Button>
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold">{exercise.title}</p>
          <p className="text-xs text-muted-foreground">
            {exercise.type === "multiple_choice" ? "Opción múltiple" : "Respuesta numérica"}
          </p>
        </div>
        <Badge className={diff.className}>{diff.label}</Badge>
      </header>

      <div className="mx-auto max-w-2xl space-y-4 p-4">
        {/* Enunciado */}
        <Card>
          <CardContent className="p-4">
            <div className="mb-1.5 flex items-center gap-1.5 text-sm font-bold">
              <BookOpen className="size-4 text-primary" /> Enunciado
            </div>
            <MathText className="text-sm text-muted-foreground">
              {exercise.prompt}
            </MathText>
          </CardContent>
        </Card>

        {locked && (
          <div className="flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm font-medium text-destructive">
            <Lock className="size-5 shrink-0" /> Esta tarea está cerrada.
          </div>
        )}

        {/* Respuesta */}
        {exercise.type === "multiple_choice" ? (
          <div className="space-y-2">
            {exercise.options.map((opt, i) => (
              <button
                key={i}
                type="button"
                disabled={locked || !!result}
                onClick={() => setSelected(i)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl border p-4 text-left text-sm transition-colors",
                  selected === i
                    ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                    : "hover:bg-muted/50",
                )}
              >
                <span
                  className={cn(
                    "grid size-6 shrink-0 place-items-center rounded-full border text-xs font-bold",
                    selected === i ? "border-primary text-primary" : "text-muted-foreground",
                  )}
                >
                  {String.fromCharCode(65 + i)}
                </span>
                {opt}
              </button>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="space-y-2 p-4">
              <label className="text-sm font-semibold" htmlFor="num-answer">
                Tu respuesta
              </label>
              <Input
                id="num-answer"
                type="number"
                step="any"
                inputMode="decimal"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                disabled={locked || !!result}
                placeholder="Escribe el resultado…"
                className="text-lg"
              />
            </CardContent>
          </Card>
        )}

        {/* Resultado */}
        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "flex items-center gap-3 rounded-xl border p-4",
                result.correct
                  ? "border-success/30 bg-success/5 text-success"
                  : "border-warning/30 bg-warning/5 text-warning",
              )}
            >
              {result.correct ? (
                <CheckCircle2 className="size-6 shrink-0" />
              ) : (
                <XCircle className="size-6 shrink-0" />
              )}
              <div>
                <p className="font-bold">
                  {result.correct ? "¡Respuesta correcta!" : "Respuesta incorrecta"}
                </p>
                <p className="text-sm opacity-80">Nota: {result.score}/100</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Acciones */}
        {!result ? (
          <Button
            variant="brand"
            size="lg"
            className="w-full"
            disabled={!canSubmit || submitting || locked}
            onClick={submit}
          >
            {submitting ? <Spinner className="size-4" /> : "Enviar respuesta"}
          </Button>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => navigate(-1)}>
              Volver
            </Button>
            <Button
              variant="brand"
              onClick={() => {
                setResult(null);
                setSelected(null);
                setValue("");
              }}
            >
              Intentar de nuevo
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
