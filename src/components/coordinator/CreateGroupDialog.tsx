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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/common/Spinner";
import { useToast } from "@/components/ui/toast";
import { useFaculties, useCareers, useSubjects } from "@/hooks/useCatalog";
import { useCreateGroup } from "@/hooks/useCoordinator";

export function CreateGroupDialog() {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const { mutateAsync, isPending } = useCreateGroup();

  const [title, setTitle] = useState("");
  const [facultyId, setFacultyId] = useState("");
  const [careerId, setCareerId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [tutorEmail, setTutorEmail] = useState("");
  const [schedule, setSchedule] = useState("");

  const { data: faculties } = useFaculties();
  const { data: careers } = useCareers(facultyId);
  const { data: subjects } = useSubjects(careerId);

  const reset = () => {
    setTitle("");
    setFacultyId("");
    setCareerId("");
    setSubjectId("");
    setTutorEmail("");
    setSchedule("");
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subjectId) {
      toast("Elige Facultad → Carrera → Asignatura.", "error");
      return;
    }
    try {
      const r = await mutateAsync({ title, subjectId, tutorEmail, schedule });
      toast(`Grupo creado · código ${r.join_code}`, "success");
      setOpen(false);
      reset();
    } catch (err) {
      toast(err instanceof Error ? err.message : "No se pudo crear", "error");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="brand" size="sm">
          <Plus className="size-4" /> Crear grupo
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Crear grupo de tutoría</DialogTitle>
          <DialogDescription>
            Asigna un tutor y un horario; luego agregas a los estudiantes.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="g-title">Nombre del grupo</Label>
            <Input
              id="g-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej. Algoritmos — Grupo A"
              required
              autoFocus
            />
          </div>

          {/* Catálogo obligatorio */}
          <div className="space-y-2 rounded-xl border p-3">
            <Label className="text-xs text-muted-foreground">
              Ubicación académica
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
                      Crea asignaturas en Admin → Catálogo.
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
            <Label htmlFor="g-tutor">Correo del tutor</Label>
            <Input
              id="g-tutor"
              type="email"
              value={tutorEmail}
              onChange={(e) => setTutorEmail(e.target.value)}
              placeholder="tutor@uniguajira.edu.co"
              required
            />
            <p className="text-xs text-muted-foreground">
              Debe tener cuenta. Se le asignará como profesor del grupo.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="g-sched">Horario</Label>
            <Input
              id="g-sched"
              value={schedule}
              onChange={(e) => setSchedule(e.target.value)}
              placeholder="Ej. Lun y Mié 2–4pm · Aula 301"
            />
          </div>

          <Button
            type="submit"
            variant="brand"
            className="w-full"
            disabled={isPending}
          >
            {isPending ? <Spinner className="size-4" /> : "Crear grupo"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
