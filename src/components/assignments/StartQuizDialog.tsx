import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Radio, Users2, Gauge } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Spinner } from "@/components/common/Spinner";
import { useToast } from "@/components/ui/toast";
import { useStartQuizSession } from "@/hooks/useQuiz";
import { cn } from "@/lib/utils";
import type { QuizMode } from "@/types/database";

const MODES: { value: QuizMode; label: string; desc: string; icon: typeof Users2 }[] = [
  {
    value: "sync",
    label: "Preguntas al mismo tiempo",
    desc: "Todos ven la misma pregunta a la vez; tú decides cuándo pasa la siguiente.",
    icon: Users2,
  },
  {
    value: "pace",
    label: "Preguntas a su ritmo",
    desc: "Cada estudiante avanza solo, a su propio paso, sin esperar a nadie.",
    icon: Gauge,
  },
];

/** El tutor inicia un quiz en vivo sobre las preguntas de opción múltiple
 * de esta tarea, eligiendo el modo. */
export function StartQuizDialog({ assignmentId }: { assignmentId: string }) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<QuizMode>("pace");
  const [shuffle, setShuffle] = useState(false);
  const { mutateAsync, isPending } = useStartQuizSession();

  const submit = async () => {
    try {
      const sessionId = await mutateAsync({ assignmentId, mode, shuffle });
      setOpen(false);
      navigate(`/app/quiz/${sessionId}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "No se pudo iniciar el quiz", "error");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="brand">
          <Radio className="size-4" /> Quiz en vivo
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Iniciar quiz en vivo</DialogTitle>
          <DialogDescription>
            Tus estudiantes entran con un código QR y responden desde su celular.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => setMode(m.value)}
              className={cn(
                "flex w-full items-start gap-3 rounded-xl border-2 p-3 text-left transition-colors",
                mode === m.value
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/40",
              )}
            >
              <m.icon
                className={cn(
                  "mt-0.5 size-5 shrink-0",
                  mode === m.value ? "text-primary" : "text-muted-foreground",
                )}
              />
              <span>
                <span className="block text-sm font-semibold">{m.label}</span>
                <span className="block text-xs text-muted-foreground">{m.desc}</span>
              </span>
            </button>
          ))}
        </div>

        <div className="flex items-start gap-3 rounded-xl border p-3">
          <Switch id="qz-shuffle" checked={shuffle} onCheckedChange={setShuffle} />
          <label htmlFor="qz-shuffle" className="cursor-pointer">
            <span className="block text-sm font-semibold">
              Barajar el orden de las preguntas
            </span>
            <span className="block text-xs text-muted-foreground">
              Cada estudiante las recibe en un orden distinto, para que sea
              más difícil copiarse. Las opciones (A/B/C/D) ya se mezclan
              siempre, con o sin esto activado.
            </span>
          </label>
        </div>

        <Button variant="brand" className="w-full" onClick={submit} disabled={isPending}>
          {isPending ? <Spinner className="size-4" /> : "Iniciar"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
