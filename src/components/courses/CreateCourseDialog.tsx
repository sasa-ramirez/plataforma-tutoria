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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/common/Spinner";
import { useToast } from "@/components/ui/toast";
import { useCreateCourse } from "@/hooks/useCourses";
import { useFaculties, useCareers, useSubjects } from "@/hooks/useCatalog";
import { COURSE_COLORS, COURSE_COLOR_KEYS } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function CreateCourseDialog() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("violet");
  const [facultyId, setFacultyId] = useState("");
  const [careerId, setCareerId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const { mutateAsync, isPending } = useCreateCourse();
  const { toast } = useToast();

  const { data: faculties } = useFaculties();
  const { data: careers } = useCareers(facultyId);
  const { data: subjects } = useSubjects(careerId);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const course = await mutateAsync({
        title,
        description,
        color,
        subject_id: subjectId || null,
      });
      toast(`Curso creado · código ${course.join_code}`, "success");
      setOpen(false);
      setTitle("");
      setDescription("");
      setColor("violet");
      setFacultyId("");
      setCareerId("");
      setSubjectId("");
    } catch (err) {
      toast(err instanceof Error ? err.message : "No se pudo crear", "error");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="brand" size="sm">
          <Plus className="size-4" /> Nuevo curso
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Crear curso</DialogTitle>
          <DialogDescription>
            Se generará un código que tus estudiantes usarán para unirse.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Título</Label>
            <Input
              id="title"
              placeholder="Ej. Lógica de Programación"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="desc">Descripción (opcional)</Label>
            <Textarea
              id="desc"
              placeholder="¿De qué trata el curso?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          {/* Facultad → Carrera → Asignatura (opcional) */}
          <div className="space-y-2 rounded-xl border p-3">
            <Label className="text-xs text-muted-foreground">
              Ubicación académica (opcional)
            </Label>
            <Select
              value={facultyId}
              onValueChange={(v) => {
                setFacultyId(v);
                setCareerId("");
                setSubjectId("");
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Facultad" />
              </SelectTrigger>
              <SelectContent>
                {(faculties ?? []).map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {facultyId && (
              <Select
                value={careerId}
                onValueChange={(v) => {
                  setCareerId(v);
                  setSubjectId("");
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Carrera" />
                </SelectTrigger>
                <SelectContent>
                  {(careers ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {careerId && (
              <Select value={subjectId} onValueChange={setSubjectId}>
                <SelectTrigger>
                  <SelectValue placeholder="Asignatura" />
                </SelectTrigger>
                <SelectContent>
                  {(subjects ?? []).length === 0 ? (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">
                      Esta carrera aún no tiene asignaturas (créalas en Admin).
                    </div>
                  ) : (
                    (subjects ?? []).map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-2">
            <Label>Color</Label>
            <div className="flex flex-wrap gap-2">
              {COURSE_COLOR_KEYS.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setColor(key)}
                  aria-label={COURSE_COLORS[key].label}
                  className={cn(
                    "size-9 rounded-full bg-gradient-to-br transition-transform",
                    COURSE_COLORS[key].gradient,
                    color === key
                      ? "scale-110 ring-2 ring-foreground ring-offset-2 ring-offset-background"
                      : "opacity-80 hover:opacity-100",
                  )}
                />
              ))}
            </div>
          </div>

          <Button
            type="submit"
            variant="brand"
            className="w-full"
            disabled={isPending}
          >
            {isPending ? <Spinner className="size-4" /> : "Crear curso"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
