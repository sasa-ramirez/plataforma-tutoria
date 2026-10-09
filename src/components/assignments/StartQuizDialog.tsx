import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Radio, Users2, Gauge, CalendarClock } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import { Spinner } from "@/components/common/Spinner";
import { useToast } from "@/components/ui/toast";
import { useStartQuizSession } from "@/hooks/useQuiz";
import { localDateTimeInput } from "@/lib/quizSession";
import { cn } from "@/lib/utils";
import type { QuizMode } from "@/types/database";

/** Cómo se aplica el quiz: los dos modos en vivo de siempre, o "tarea abierta". */
type Kind = QuizMode | "open";

const MODES: { value: Kind; label: string; desc: string; icon: typeof Users2 }[] = [
  {
    value: "sync",
    label: "Preguntas al mismo tiempo",
    desc: "Todos ven la misma pregunta a la vez; tú decides cuándo pasa la siguiente.",
    icon: Users2,
  },
  {
    value: "pace",
    label: "Preguntas a su ritmo",
    desc: "Cada estudiante avanza solo, a su propio paso, sin esperar a nadie. Tú das Comenzar.",
    icon: Gauge,
  },
  {
    value: "open",
    label: "Tarea abierta",
    desc: "Queda abierto desde ya: cada estudiante lo hace cuando quiera (ahora o en la noche), a su ritmo y con un solo intento. No hace falta que estés conectado.",
    icon: CalendarClock,
  },
];

/** El tutor inicia un quiz sobre las preguntas de opción múltiple de esta
 * tarea, eligiendo cómo se aplica. */
export function StartQuizDialog({ assignmentId }: { assignmentId: string }) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<Kind>("pace");
  const [shuffle, setShuffle] = useState(false);
  const [useDeadline, setUseDeadline] = useState(false);
  const [deadline, setDeadline] = useState(() => localDateTimeInput(24));
  const { mutateAsync, isPending } = useStartQuizSession();

  const submit = async () => {
    let closesAt: string | null = null;
    if (kind === "open" && useDeadline) {
      const d = new Date(deadline);
      if (!deadline || Number.isNaN(d.getTime()) || d.getTime() <= Date.now()) {
        toast("La hora de cierre tiene que ser en el futuro.", "error");
        return;
      }
      closesAt = d.toISOString();
    }
    try {
      const sessionId = await mutateAsync({
        assignmentId,
        mode: kind === "open" ? "pace" : kind,
        shuffle,
        open: kind === "open",
        closesAt,
      });
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
          <DialogTitle>Iniciar quiz</DialogTitle>
          <DialogDescription>
            Tus estudiantes entran con un código QR o desde la tarea y responden desde su celular.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => setKind(m.value)}
              className={cn(
                "flex w-full items-start gap-3 rounded-xl border-2 p-3 text-left transition-colors",
                kind === m.value
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/40",
              )}
            >
              <m.icon
                className={cn(
                  "mt-0.5 size-5 shrink-0",
                  kind === m.value ? "text-primary" : "text-muted-foreground",
                )}
              />
              <span>
                <span className="block text-sm font-semibold">{m.label}</span>
                <span className="block text-xs text-muted-foreground">{m.desc}</span>
              </span>
            </button>
          ))}
        </div>

        {kind === "open" && (
          <div className="space-y-2 rounded-xl border p-3">
            <div className="flex items-start gap-3">
              <Switch id="qz-deadline" checked={useDeadline} onCheckedChange={setUseDeadline} />
              <label htmlFor="qz-deadline" className="cursor-pointer">
                <span className="block text-sm font-semibold">Cerrar solo a una fecha y hora</span>
                <span className="block text-xs text-muted-foreground">
                  Pasada esa hora nadie puede entrar ni responder. Si no lo activas, queda abierto hasta que
                  tú lo termines.
                </span>
              </label>
            </div>
            {useDeadline && (
              <Input
                type="datetime-local"
                value={deadline}
                min={localDateTimeInput(0)}
                onChange={(e) => setDeadline(e.target.value)}
                aria-label="Fecha y hora de cierre"
              />
            )}
          </div>
        )}

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
          {isPending ? <Spinner className="size-4" /> : kind === "open" ? "Abrir ahora" : "Iniciar"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
