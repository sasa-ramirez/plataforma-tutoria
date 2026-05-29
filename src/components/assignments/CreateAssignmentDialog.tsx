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

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
                value={form.opens_at}
                onChange={(e) => set("opens_at", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="closes">Cierre</Label>
              <Input
                id="closes"
                type="datetime-local"
                value={form.closes_at}
                onChange={(e) => set("closes_at", e.target.value)}
              />
            </div>
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
