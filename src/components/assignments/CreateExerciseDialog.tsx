import { useState } from "react";
import { Plus, Trash2, Code2, ListChecks, Hash, PenLine } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/common/Spinner";
import { useToast } from "@/components/ui/toast";
import { useCreateExercise } from "@/hooks/useAssignments";
import { STARTER_CODE } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { Assignment, ExerciseType } from "@/types/database";

const TYPES: { id: ExerciseType; label: string; icon: typeof Code2 }[] = [
  { id: "code", label: "Código", icon: Code2 },
  { id: "multiple_choice", label: "Opción múltiple", icon: ListChecks },
  { id: "numeric", label: "Numérica", icon: Hash },
  { id: "open", label: "Respuesta abierta", icon: PenLine },
];

export function CreateExerciseDialog({
  assignment,
  nextIndex,
}: {
  assignment: Assignment;
  nextIndex: number;
}) {
  const [open, setOpen] = useState(false);
  const { mutateAsync, isPending } = useCreateExercise(assignment.id);
  const { toast } = useToast();

  const [type, setType] = useState<ExerciseType>("code");
  const [title, setTitle] = useState("");
  const [prompt, setPrompt] = useState("");
  // Código
  const [starter, setStarter] = useState(STARTER_CODE[assignment.language]);
  const [solution, setSolution] = useState("");
  // Opción múltiple
  const [options, setOptions] = useState<string[]>(["", ""]);
  const [correct, setCorrect] = useState(0);
  // Numérica
  const [answer, setAnswer] = useState("");
  const [tolerance, setTolerance] = useState("0");
  // Respuesta abierta
  const [rubric, setRubric] = useState("");

  const reset = () => {
    setType("code");
    setTitle("");
    setPrompt("");
    setStarter(STARTER_CODE[assignment.language]);
    setSolution("");
    setOptions(["", ""]);
    setCorrect(0);
    setAnswer("");
    setTolerance("0");
    setRubric("");
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validaciones por tipo
    if (type === "multiple_choice") {
      const filled = options.map((o) => o.trim());
      if (filled.filter(Boolean).length < 2) {
        toast("Agrega al menos 2 opciones.", "error");
        return;
      }
      if (!filled[correct]) {
        toast("Marca cuál opción es la correcta.", "error");
        return;
      }
    }
    if (type === "numeric" && answer.trim() === "") {
      toast("Escribe la respuesta numérica correcta.", "error");
      return;
    }

    try {
      const base = {
        assignment_id: assignment.id,
        title,
        prompt,
        language: assignment.language,
        difficulty: assignment.difficulty,
        points: assignment.points,
        order_index: nextIndex,
        type,
      };

      if (type === "code") {
        await mutateAsync({
          ...base,
          starter_code: starter,
          solution_code: solution || undefined,
        });
      } else if (type === "multiple_choice") {
        await mutateAsync({
          ...base,
          options: options.map((o) => o.trim()).filter(Boolean),
          answer_key: { correct: String(correct) },
        });
      } else if (type === "numeric") {
        await mutateAsync({
          ...base,
          answer_key: {
            value: Number(answer),
            tolerance: Number(tolerance) || 0,
          },
        });
      } else {
        // Respuesta abierta: la IA califica con la rúbrica.
        await mutateAsync({
          ...base,
          answer_key: rubric.trim() ? { rubric: rubric.trim() } : {},
        });
      }

      toast("Ejercicio añadido ✅", "success");
      setOpen(false);
      reset();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Error", "error");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="brand" size="sm">
          <Plus className="size-4" /> Ejercicio
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nuevo ejercicio</DialogTitle>
          <DialogDescription>
            Elige el tipo y completa los datos.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          {/* Selector de tipo */}
          <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted/50 p-1 sm:grid-cols-4">
            {TYPES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setType(t.id)}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-lg px-1 py-2 text-center text-[11px] font-semibold leading-tight transition-colors",
                  type === t.id
                    ? "bg-card text-foreground shadow"
                    : "text-muted-foreground",
                )}
              >
                <t.icon className="size-4" />
                {t.label}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            <Label htmlFor="ex-title">Título</Label>
            <Input
              id="ex-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej. Suma de dos números"
              required
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ex-prompt">Enunciado</Label>
            <Textarea
              id="ex-prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe el problema o la pregunta…"
              className="min-h-[90px]"
              required
            />
          </div>

          {/* ---- Campos según el tipo ---- */}
          {type === "code" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="ex-starter">Código inicial</Label>
                <Textarea
                  id="ex-starter"
                  value={starter}
                  onChange={(e) => setStarter(e.target.value)}
                  className="font-mono text-xs"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ex-sol">Solución (referencia para la IA)</Label>
                <Textarea
                  id="ex-sol"
                  value={solution}
                  onChange={(e) => setSolution(e.target.value)}
                  className="font-mono text-xs"
                  placeholder="Opcional"
                />
              </div>
            </>
          )}

          {type === "multiple_choice" && (
            <div className="space-y-2">
              <Label>Opciones (marca la correcta)</Label>
              {options.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="correct"
                    checked={correct === i}
                    onChange={() => setCorrect(i)}
                    className="size-4 accent-primary"
                    aria-label={`Marcar opción ${i + 1} como correcta`}
                  />
                  <Input
                    value={opt}
                    onChange={(e) => {
                      const next = [...options];
                      next[i] = e.target.value;
                      setOptions(next);
                    }}
                    placeholder={`Opción ${i + 1}`}
                  />
                  {options.length > 2 && (
                    <button
                      type="button"
                      onClick={() => {
                        setOptions(options.filter((_, j) => j !== i));
                        if (correct >= i && correct > 0) setCorrect(correct - 1);
                      }}
                      className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      aria-label="Quitar opción"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  )}
                </div>
              ))}
              {options.length < 6 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setOptions([...options, ""])}
                >
                  <Plus className="size-4" /> Agregar opción
                </Button>
              )}
            </div>
          )}

          {type === "numeric" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="ex-ans">Respuesta correcta</Label>
                <Input
                  id="ex-ans"
                  type="number"
                  step="any"
                  inputMode="decimal"
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder="Ej. 78.54"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ex-tol">Tolerancia (±)</Label>
                <Input
                  id="ex-tol"
                  type="number"
                  step="any"
                  inputMode="decimal"
                  value={tolerance}
                  onChange={(e) => setTolerance(e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>
          )}

          {type === "open" && (
            <div className="space-y-2">
              <Label htmlFor="ex-rubric">Rúbrica (guía para la IA)</Label>
              <Textarea
                id="ex-rubric"
                value={rubric}
                onChange={(e) => setRubric(e.target.value)}
                className="min-h-[90px] text-sm"
                placeholder="Qué debe contener una buena respuesta: conceptos clave, procedimiento, ejemplo… La IA califica con esto."
              />
            </div>
          )}

          <Button
            type="submit"
            variant="brand"
            className="w-full"
            disabled={isPending}
          >
            {isPending ? <Spinner className="size-4" /> : "Añadir ejercicio"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
