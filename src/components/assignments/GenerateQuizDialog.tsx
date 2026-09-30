import { useState } from "react";
import { Sparkles, Wand2 } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/common/Spinner";
import { useToast } from "@/components/ui/toast";
import { useGenerateQuiz } from "@/hooks/useAssignments";
import { DIFFICULTY_META } from "@/lib/constants";
import type { Assignment, Difficulty } from "@/types/database";

const MAX_QUESTIONS = 20;

/** El tutor pone tema, cuántas preguntas y la dificultad; la IA genera todo
 * el lote de una vez como ejercicios de opción múltiple, listos para el
 * quiz en vivo o para una tarea normal. */
export function GenerateQuizDialog({
  assignment,
  subjectName,
}: {
  assignment: Assignment;
  subjectName?: string | null;
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState("");
  const [count, setCount] = useState(10);
  const [difficulty, setDifficulty] = useState<Difficulty>(assignment.difficulty);
  const { mutateAsync, isPending } = useGenerateQuiz(assignment.id);

  const submit = async () => {
    if (!topic.trim()) {
      toast("Escribe sobre qué tema quieres las preguntas.", "error");
      return;
    }
    try {
      const created = await mutateAsync({
        assignmentId: assignment.id,
        language: assignment.language,
        topic,
        count,
        difficulty,
        subjectHint: subjectName,
      });
      toast(`Se agregaron ${created} pregunta${created === 1 ? "" : "s"}`, "success");
      setOpen(false);
      setTopic("");
    } catch (e) {
      toast(e instanceof Error ? e.message : "No se pudo generar el quiz", "error");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Sparkles className="size-4" /> Generar con IA
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Generar preguntas con IA</DialogTitle>
          <DialogDescription>
            Ponle un tema, cuántas preguntas y la dificultad — la IA arma
            todo el lote de una vez, ya listo para un quiz en vivo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="qz-topic">Tema</Label>
            <Input
              id="qz-topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Ej. Derivadas, Presente perfecto, Ciclos en PSeInt…"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="qz-count">Cuántas preguntas</Label>
              <Input
                id="qz-count"
                type="number"
                inputMode="numeric"
                min={1}
                max={MAX_QUESTIONS}
                value={count}
                onChange={(e) =>
                  setCount(
                    Math.max(1, Math.min(MAX_QUESTIONS, Number(e.target.value) || 1)),
                  )
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Dificultad</Label>
              <Select
                value={difficulty}
                onValueChange={(v) => setDifficulty(v as Difficulty)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(DIFFICULTY_META).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground">
            Se agregan al final de esta tarea, junto a los ejercicios que ya
            tenga. Revísalas antes de usarlas — la IA puede equivocarse.
          </p>

          <Button variant="brand" className="w-full" onClick={submit} disabled={isPending}>
            {isPending ? (
              <>
                <Spinner className="size-4" /> Generando… puede tardar unos segundos
              </>
            ) : (
              <>
                <Wand2 className="size-4" /> Generar {count} pregunta{count === 1 ? "" : "s"}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
