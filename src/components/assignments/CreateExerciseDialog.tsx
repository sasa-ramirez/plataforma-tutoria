import { useState } from "react";
import { Plus } from "lucide-react";
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
import type { Assignment } from "@/types/database";

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

  const [title, setTitle] = useState("");
  const [prompt, setPrompt] = useState("");
  const [starter, setStarter] = useState(STARTER_CODE[assignment.language]);
  const [solution, setSolution] = useState("");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await mutateAsync({
        assignment_id: assignment.id,
        title,
        prompt,
        starter_code: starter,
        solution_code: solution || undefined,
        language: assignment.language,
        difficulty: assignment.difficulty,
        points: assignment.points,
        order_index: nextIndex,
      });
      toast("Ejercicio añadido ✅", "success");
      setOpen(false);
      setTitle("");
      setPrompt("");
      setSolution("");
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
            En {assignment.language.toUpperCase()} · {assignment.points} pts
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
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
              placeholder="Describe qué debe resolver el estudiante…"
              className="min-h-[100px]"
              required
            />
          </div>
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
            <Label htmlFor="ex-sol">Solución (visible tras resolver)</Label>
            <Textarea
              id="ex-sol"
              value={solution}
              onChange={(e) => setSolution(e.target.value)}
              className="font-mono text-xs"
              placeholder="Opcional, pero la IA la usa como referencia"
            />
          </div>

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
