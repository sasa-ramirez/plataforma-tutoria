import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { FileText, Plus, Camera, X, Printer, Trash2 } from "lucide-react";
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
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/common/Spinner";
import { useToast } from "@/components/ui/toast";
import { useCourseMembers, useCourseProgramInfo } from "@/hooks/useCourses";
import { useTutoringSessions } from "@/hooks/useTutoring";
import { useReports, useCreateReport, useDeleteReport } from "@/hooks/useReports";

const todayStr = () => new Date().toISOString().slice(0, 10);

export function PeriodicReportCard({
  courseId,
  courseTitle,
  tutorName,
  professorName,
}: {
  courseId: string;
  courseTitle: string;
  tutorName: string;
  professorName: string | null;
}) {
  const { data: reports, isLoading } = useReports(courseId);
  const { mutateAsync: remove, isPending: removing } = useDeleteReport(courseId);
  const { toast } = useToast();

  const handleDelete = async (id: string) => {
    const report = reports?.find((r) => r.id === id);
    if (!report) return;
    if (!window.confirm("¿Eliminar este informe? También se borra la foto.")) return;
    try {
      await remove(report);
      toast("Informe eliminado", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "No se pudo eliminar", "error");
    }
  };

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-base font-bold">
            <FileText className="size-4 text-primary" /> Informe periódico
          </div>
          <NewReportDialog
            courseId={courseId}
            courseTitle={courseTitle}
            tutorName={tutorName}
            professorName={professorName}
          />
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : !reports || reports.length === 0 ? (
          <p className="py-2 text-xs text-muted-foreground">
            Aún no registras informes. Uno por corte, con "Nuevo informe".
          </p>
        ) : (
          <div className="space-y-2">
            {reports.map((r) => (
              <div
                key={r.id}
                className="flex items-center gap-3 rounded-xl border px-3 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">
                    {new Date(r.report_date + "T00:00:00").toLocaleDateString("es-CO", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {r.topics || r.description}
                  </p>
                </div>
                <Button size="sm" variant="outline" asChild>
                  <Link to={`/app/reports/${r.id}/print`} target="_blank">
                    <Printer className="size-4" /> Ver
                  </Link>
                </Button>
                <button
                  onClick={() => handleDelete(r.id)}
                  disabled={removing}
                  className="shrink-0 rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  aria-label="Eliminar informe"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function NewReportDialog({
  courseId,
  courseTitle,
  tutorName,
  professorName,
}: {
  courseId: string;
  courseTitle: string;
  tutorName: string;
  professorName: string | null;
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: members } = useCourseMembers(courseId, open);
  const { data: programInfo } = useCourseProgramInfo(courseId, open);
  const { data: sessions } = useTutoringSessions(courseId);
  const { mutateAsync: create, isPending } = useCreateReport(courseId);

  const [reportDate, setReportDate] = useState(todayStr());
  const [place, setPlace] = useState("Bienestar Social Universitario");
  const [groupLabel, setGroupLabel] = useState(courseTitle);
  const [participants, setParticipants] = useState("");
  const [semester, setSemester] = useState("");
  const [topics, setTopics] = useState("");
  const [description, setDescription] = useState("");
  const [observations, setObservations] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  // Prellena participantes y temas al abrir (roster + temas de las sesiones ya registradas).
  useEffect(() => {
    if (!open) return;
    if (members) setParticipants((p) => p || String(members.length));
    if (sessions) {
      const uniqueTopics = [
        ...new Set(sessions.map((s) => s.topic).filter((t): t is string => !!t)),
      ];
      if (uniqueTopics.length) setTopics((t) => t || uniqueTopics.join(", "));
    }
  }, [open, members, sessions]);

  const reset = () => {
    setReportDate(todayStr());
    setPlace("Bienestar Social Universitario");
    setGroupLabel(courseTitle);
    setParticipants("");
    setSemester("");
    setTopics("");
    setDescription("");
    setObservations("");
    setPhoto(null);
    setPhotoPreview(null);
  };

  const pickPhoto = (file: File | null) => {
    setPhoto(file);
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoPreview(file ? URL.createObjectURL(file) : null);
  };

  const submit = async () => {
    if (!description.trim()) {
      toast("Escribe la descripción de la tutoría.", "error");
      return;
    }
    try {
      await create({
        tutorName,
        reportDate,
        place,
        groupLabel,
        participantsCount: participants ? Number(participants) : null,
        programName: programInfo?.programName ?? null,
        subjectName: programInfo?.subjectName ?? null,
        semester,
        professorName,
        topics,
        description,
        observations,
        photo,
      });
      toast("Informe guardado", "success");
      setOpen(false);
      reset();
    } catch (e) {
      toast(e instanceof Error ? e.message : "No se pudo guardar", "error");
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="brand">
          <Plus className="size-4" /> Nuevo informe
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Informe periódico de actividades</DialogTitle>
          <DialogDescription>
            Uno por corte. Se arma con el formato oficial (BS-F-17) para descargar o imprimir.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="rep-date">Fecha</Label>
              <Input
                id="rep-date"
                type="date"
                value={reportDate}
                onChange={(e) => setReportDate(e.target.value)}
                max={todayStr()}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rep-part">N.º de participantes</Label>
              <Input
                id="rep-part"
                type="number"
                min={0}
                value={participants}
                onChange={(e) => setParticipants(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="rep-place">Lugar</Label>
              <Input id="rep-place" value={place} onChange={(e) => setPlace(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rep-group">Grupo</Label>
              <Input
                id="rep-group"
                value={groupLabel}
                onChange={(e) => setGroupLabel(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="rep-sem">Semestre</Label>
            <Input
              id="rep-sem"
              value={semester}
              onChange={(e) => setSemester(e.target.value)}
              placeholder="Ej. 1"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="rep-topics">Temas desarrollados</Label>
            <Textarea
              id="rep-topics"
              value={topics}
              onChange={(e) => setTopics(e.target.value)}
              className="min-h-[60px] text-sm"
              placeholder="Se sugieren solos de tus sesiones registradas — ajústalos si hace falta."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="rep-desc">Descripción</Label>
            <Textarea
              id="rep-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-[90px] text-sm"
              placeholder="Qué se trabajó y cómo les fue…"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="rep-obs">Observaciones (opcional)</Label>
            <Textarea
              id="rep-obs"
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              className="min-h-[70px] text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label>Foto de evidencia</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => pickPhoto(e.target.files?.[0] ?? null)}
            />
            {photoPreview ? (
              <div className="relative w-fit">
                <img
                  src={photoPreview}
                  alt="Foto de evidencia"
                  className="max-h-48 rounded-xl border object-cover"
                />
                <button
                  type="button"
                  onClick={() => pickPhoto(null)}
                  className="absolute -right-2 -top-2 grid size-7 place-items-center rounded-full bg-destructive text-white shadow"
                  aria-label="Quitar foto"
                >
                  <X className="size-4" />
                </button>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => fileInputRef.current?.click()}
              >
                <Camera className="size-4" /> Tomar o elegir foto
              </Button>
            )}
          </div>

          <Button variant="brand" className="w-full" onClick={submit} disabled={isPending}>
            {isPending ? <Spinner className="size-4" /> : "Guardar informe"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
