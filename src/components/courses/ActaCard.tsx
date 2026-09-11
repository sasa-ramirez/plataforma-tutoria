import { useState } from "react";
import { ClipboardType, Plus, FileDown, Trash2 } from "lucide-react";
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
import { useCourseProgramInfo } from "@/hooks/useCourses";
import { useActas, useCreateActa, useDeleteActa } from "@/hooks/useActas";
import { downloadActaDocx } from "@/lib/exportActa";

const todayStr = () => new Date().toISOString().slice(0, 10);

export function ActaCard({
  courseId,
  tutorName,
  professorName,
}: {
  courseId: string;
  tutorName: string;
  professorName: string | null;
}) {
  const { data: actas, isLoading } = useActas(courseId);
  const { mutateAsync: remove, isPending: removing } = useDeleteActa(courseId);
  const { toast } = useToast();
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    if (!window.confirm("¿Eliminar esta acta?")) return;
    try {
      await remove(id);
      toast("Acta eliminada", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "No se pudo eliminar", "error");
    }
  };

  const handleDownload = async (id: string) => {
    const acta = actas?.find((a) => a.id === id);
    if (!acta) return;
    setDownloadingId(id);
    try {
      await downloadActaDocx(acta);
    } catch (e) {
      toast(e instanceof Error ? e.message : "No se pudo generar el Word", "error");
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-base font-bold">
            <ClipboardType className="size-4 text-primary" /> Actas de reunión
          </div>
          <NewActaDialog courseId={courseId} tutorName={tutorName} professorName={professorName} />
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : !actas || actas.length === 0 ? (
          <p className="py-2 text-xs text-muted-foreground">
            Aún no registras actas. Levanta una por cada reunión con el grupo.
          </p>
        ) : (
          <div className="space-y-2">
            {actas.map((a) => (
              <div
                key={a.id}
                className="flex items-center gap-3 rounded-xl border px-3 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">
                    {new Date(a.acta_date + "T00:00:00").toLocaleDateString("es-CO", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {a.asunto || a.desarrollo}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleDownload(a.id)}
                  disabled={downloadingId === a.id}
                >
                  {downloadingId === a.id ? (
                    <Spinner className="size-4" />
                  ) : (
                    <FileDown className="size-4" />
                  )}
                  Word
                </Button>
                <button
                  onClick={() => handleDelete(a.id)}
                  disabled={removing}
                  className="shrink-0 rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  aria-label="Eliminar acta"
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

function NewActaDialog({
  courseId,
  tutorName,
  professorName,
}: {
  courseId: string;
  tutorName: string;
  professorName: string | null;
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const { data: programInfo } = useCourseProgramInfo(courseId, open);
  const { mutateAsync: create, isPending } = useCreateActa(courseId);

  const [actaNumber, setActaNumber] = useState("");
  const [actaDate, setActaDate] = useState(todayStr());
  const [organismo, setOrganismo] = useState("Permanencia y Graduación Exitosa");
  const [asunto, setAsunto] = useState("");
  const [ordenDia, setOrdenDia] = useState("");
  const [desarrollo, setDesarrollo] = useState("");
  const [conclusiones, setConclusiones] = useState("");
  const [compromisos, setCompromisos] = useState("");
  const [observaciones, setObservaciones] = useState("");

  const reset = () => {
    setActaNumber("");
    setActaDate(todayStr());
    setOrganismo("Permanencia y Graduación Exitosa");
    setAsunto("");
    setOrdenDia("");
    setDesarrollo("");
    setConclusiones("");
    setCompromisos("");
    setObservaciones("");
  };

  const submit = async () => {
    if (!desarrollo.trim()) {
      toast("Escribe qué se hizo en la reunión (desarrollo).", "error");
      return;
    }
    try {
      await create({
        tutorName,
        actaNumber,
        actaDate,
        organismo,
        asunto,
        programName: programInfo?.programName ?? null,
        professorName,
        ordenDia,
        desarrollo,
        conclusiones,
        compromisos,
        observaciones,
      });
      toast("Acta guardada", "success");
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
          <Plus className="size-4" /> Nueva acta
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Acta de reunión</DialogTitle>
          <DialogDescription>
            Se descarga como Word con el formato oficial (AD-F-01). Las firmas quedan en
            blanco para firmar a mano.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="acta-date">Fecha</Label>
              <Input
                id="acta-date"
                type="date"
                value={actaDate}
                onChange={(e) => setActaDate(e.target.value)}
                max={todayStr()}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="acta-num">N.º de acta (opcional)</Label>
              <Input id="acta-num" value={actaNumber} onChange={(e) => setActaNumber(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="acta-org">Organismo / dependencia</Label>
            <Input id="acta-org" value={organismo} onChange={(e) => setOrganismo(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="acta-asunto">Asunto</Label>
            <Input
              id="acta-asunto"
              value={asunto}
              onChange={(e) => setAsunto(e.target.value)}
              placeholder="Ej. Presentación tutor, Seguimiento tutoría…"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="acta-orden">Orden del día</Label>
            <Textarea
              id="acta-orden"
              value={ordenDia}
              onChange={(e) => setOrdenDia(e.target.value)}
              className="min-h-[70px] text-sm"
              placeholder={"1: presentación\n2: hablar con los estudiantes…"}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="acta-desarrollo">Desarrollo</Label>
            <Textarea
              id="acta-desarrollo"
              value={desarrollo}
              onChange={(e) => setDesarrollo(e.target.value)}
              className="min-h-[90px] text-sm"
              placeholder="Qué pasó en la reunión…"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="acta-conclusiones">Conclusiones / decisiones</Label>
            <Textarea
              id="acta-conclusiones"
              value={conclusiones}
              onChange={(e) => setConclusiones(e.target.value)}
              className="min-h-[70px] text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="acta-compromisos">Compromisos adquiridos</Label>
            <Textarea
              id="acta-compromisos"
              value={compromisos}
              onChange={(e) => setCompromisos(e.target.value)}
              className="min-h-[70px] text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="acta-obs">Observaciones (opcional)</Label>
            <Textarea
              id="acta-obs"
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              className="min-h-[70px] text-sm"
            />
          </div>

          <Button variant="brand" className="w-full" onClick={submit} disabled={isPending}>
            {isPending ? <Spinner className="size-4" /> : "Guardar acta"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
