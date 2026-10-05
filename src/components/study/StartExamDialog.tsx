import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ClipboardCheck, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/common/Spinner";
import { useToast } from "@/components/ui/toast";
import { useCreateStudyExam } from "@/hooks/useStudy";
import type { ExamDifficulty } from "@/services/study";
import { cn } from "@/lib/utils";

const COUNTS = [10, 15, 20, 30];
const LEVELS: { value: ExamDifficulty; label: string; desc: string }[] = [
  { value: "mixed", label: "Variado", desc: "Como un parcial real" },
  { value: "easy", label: "Fácil", desc: "Conceptos básicos" },
  { value: "medium", label: "Medio", desc: "Relacionar conceptos" },
  { value: "hard", label: "Difícil", desc: "Casos y aplicación" },
];

/** Pide a Kodea un parcial simulado con las notas de la materia. */
export function StartExamDialog({
  spaceId,
  topicCount,
  disabled,
}: {
  spaceId: string;
  /** Temas disponibles en las notas (para avisar cuánto cubrirá el parcial). */
  topicCount: number;
  disabled?: boolean;
}) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(20);
  const [difficulty, setDifficulty] = useState<ExamDifficulty>("mixed");
  const { mutateAsync, isPending } = useCreateStudyExam(spaceId);

  const submit = async () => {
    try {
      const examId = await mutateAsync({ count, difficulty });
      setOpen(false);
      navigate(`/app/study/${spaceId}/exam/${examId}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "No se pudo armar el parcial", "error");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !isPending && setOpen(v)}>
      <DialogTrigger asChild>
        <Button variant="brand" disabled={disabled}>
          <ClipboardCheck className="size-4" /> Parcial simulado
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Armar un parcial simulado</DialogTitle>
          <DialogDescription>
            Kodea reparte las preguntas entre los {topicCount} tema{topicCount === 1 ? "" : "s"} de tus notas
            para evaluar casi todo lo que has subido.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <p className="mb-2 text-sm font-semibold">Cuántas preguntas</p>
            <div className="grid grid-cols-4 gap-2">
              {COUNTS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCount(c)}
                  className={cn(
                    "rounded-xl border-2 py-2 text-sm font-bold transition-colors",
                    count === c ? "border-primary bg-primary/5 text-primary" : "border-border hover:border-primary/40",
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold">Dificultad</p>
            <div className="grid grid-cols-2 gap-2">
              {LEVELS.map((l) => (
                <button
                  key={l.value}
                  type="button"
                  onClick={() => setDifficulty(l.value)}
                  className={cn(
                    "rounded-xl border-2 p-2.5 text-left transition-colors",
                    difficulty === l.value ? "border-primary bg-primary/5" : "border-border hover:border-primary/40",
                  )}
                >
                  <span className="block text-sm font-semibold">{l.label}</span>
                  <span className="block text-[11px] text-muted-foreground">{l.desc}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <Button variant="brand" className="w-full" onClick={submit} disabled={isPending}>
          {isPending ? (
            <>
              <Spinner className="size-4" /> Armando tu parcial… (puede tardar medio minuto)
            </>
          ) : (
            <>
              <Sparkles className="size-4" /> Generar parcial
            </>
          )}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
