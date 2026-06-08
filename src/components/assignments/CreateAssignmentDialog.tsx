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
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/common/Spinner";
import { useToast } from "@/components/ui/toast";
import { useCreateAssignment } from "@/hooks/useAssignments";
import { LANGUAGE_META, DIFFICULTY_META } from "@/lib/constants";
import type { Difficulty, ProgLanguage } from "@/types/database";

const toIso = (local: string) => (local ? new Date(local).toISOString() : null);

/** Formatea un Date como valor de <input type="datetime-local"> en hora local. */
const toLocalInput = (d: Date) => {
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
};

export function CreateAssignmentDialog({ courseId }: { courseId: string }) {
  const [open, setOpen] = useState(false);
  const { mutateAsync, isPending } = useCreateAssignment(courseId);
  const { toast } = useToast();

  const [form, setForm] = useState({
    title: "",
    description: "",
    instructions: "",
    difficulty: "beginner" as Difficulty,
    language: "pseint" as ProgLanguage,
    points: 100,
    is_exam: false,
    time_limit_min: "",
    opens_at: "",
    closes_at: "",
    publish: true,
  });
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  // Botones rápidos de cierre (minutos desde ahora).
  const setCloseIn = (minutes: number) =>
    set("closes_at", toLocalInput(new Date(Date.now() + minutes * 60000)));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Evita el bug de crear una tarea ya cerrada (cierre en el pasado o muy pronto).
    if (form.closes_at) {
      const closeMs = new Date(form.closes_at).getTime();
      if (closeMs <= Date.now() + 30 * 60000) {
        toast(
          "El cierre debe ser al menos 30 minutos después de ahora.",
          "error",
        );
        return;
      }
      if (
        form.opens_at &&
        new Date(form.opens_at).getTime() >= closeMs
      ) {
        toast("La apertura debe ser antes del cierre.", "error");
        return;
      }
    }

    try {
      await mutateAsync({
        course_id: courseId,
        title: form.title,
        description: form.description || undefined,
        instructions: form.instructions || undefined,
        difficulty: form.difficulty,
        language: form.language,
        points: Number(form.points) || 100,
        is_exam: form.is_exam,
        time_limit_min: form.time_limit_min
          ? Number(form.time_limit_min)
          : null,
        opens_at: toIso(form.opens_at),
        closes_at: toIso(form.closes_at),
        status: form.publish ? "open" : "draft",
      });
      toast("Tarea creada ✅", "success");
      setOpen(false);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Error al crear", "error");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="brand" size="sm">
          <Plus className="size-4" /> Nueva tarea
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nueva tarea</DialogTitle>
          <DialogDescription>
            Define los detalles. Podrás añadir ejercicios después.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="t">Título</Label>
            <Input
              id="t"
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="Ej. Condicionales en Java"
              required
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="d">Descripción</Label>
            <Textarea
              id="d"
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="Resumen breve para el estudiante"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Lenguaje</Label>
              <Select
                value={form.language}
                onValueChange={(v) => set("language", v as ProgLanguage)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(LANGUAGE_META).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v.emoji} {v.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Dificultad</Label>
              <Select
                value={form.difficulty}
                onValueChange={(v) => set("difficulty", v as Difficulty)}
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

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="opens">Apertura</Label>
              <Input
                id="opens"
                type="datetime-local"
                min={toLocalInput(new Date())}
                value={form.opens_at}
                onChange={(e) => set("opens_at", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="closes">Cierre</Label>
              <Input
                id="closes"
                type="datetime-local"
                min={toLocalInput(new Date(Date.now() + 30 * 60000))}
                value={form.closes_at}
                onChange={(e) => set("closes_at", e.target.value)}
              />
            </div>
          </div>

          {/* Atajos de cierre para no equivocarse con la hora */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">Cerrar en:</span>
            {[
              { label: "1 hora", min: 60 },
              { label: "3 horas", min: 180 },
              { label: "1 día", min: 1440 },
              { label: "1 semana", min: 10080 },
            ].map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => setCloseIn(p.min)}
                className="rounded-lg bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground hover:bg-muted/70"
              >
                {p.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => set("closes_at", "")}
              className="rounded-lg bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground hover:bg-muted/70"
            >
              Sin cierre
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="pts">Puntos</Label>
              <Input
                id="pts"
                type="number"
                inputMode="numeric"
                value={form.points}
                onChange={(e) => set("points", Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lim">Tiempo límite (min)</Label>
              <Input
                id="lim"
                type="number"
                inputMode="numeric"
                placeholder="Opcional"
                value={form.time_limit_min}
                onChange={(e) => set("time_limit_min", e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl border p-3">
            <div>
              <p className="text-sm font-semibold">Modo examen 🛡️</p>
              <p className="text-xs text-muted-foreground">
                Registra salidas de pantalla y copy/paste.
              </p>
            </div>
            <Switch
              checked={form.is_exam}
              onCheckedChange={(v) => set("is_exam", v)}
            />
          </div>

          <div className="flex items-center justify-between rounded-xl border p-3">
            <div>
              <p className="text-sm font-semibold">Publicar ahora</p>
              <p className="text-xs text-muted-foreground">
                Si no, se guarda como borrador.
              </p>
            </div>
            <Switch
              checked={form.publish}
              onCheckedChange={(v) => set("publish", v)}
            />
          </div>

          <Button
            type="submit"
            variant="brand"
            className="w-full"
            disabled={isPending}
          >
            {isPending ? <Spinner className="size-4" /> : "Crear tarea"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
