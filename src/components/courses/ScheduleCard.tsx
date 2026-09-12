import { useState } from "react";
import { CalendarClock, Plus, Trash2, Check, FileDown, Pencil } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/common/Spinner";
import { useToast } from "@/components/ui/toast";
import { useScheduleOptions, useScheduleMutations } from "@/hooks/useSchedule";
import { useCourseProgramInfo } from "@/hooks/useCourses";
import { useSetScheduleManually } from "@/hooks/useTutoring";
import { cn } from "@/lib/utils";

/**
 * Cuadrar horario: el tutor propone opciones y los estudiantes votan las que
 * pueden. El horario del grupo queda automáticamente en la MÁS votada.
 */
export function ScheduleCard({
  courseId,
  courseTitle,
  tutorName,
  isTeacher,
  currentSchedule,
}: {
  courseId: string;
  courseTitle: string;
  tutorName: string;
  isTeacher: boolean;
  currentSchedule: string | null;
}) {
  const { toast } = useToast();
  const { data: options, isLoading } = useScheduleOptions(courseId);
  const { data: programInfo } = useCourseProgramInfo(courseId, isTeacher);
  const { add, remove, vote, unvote } = useScheduleMutations(courseId);
  const { mutateAsync: setManually, isPending: settingManually } =
    useSetScheduleManually(courseId);
  const [label, setLabel] = useState("");
  const [exporting, setExporting] = useState(false);
  const [editingManually, setEditingManually] = useState(false);
  const [manualValue, setManualValue] = useState(currentSchedule ?? "");

  const saveManual = async () => {
    try {
      await setManually(manualValue);
      setEditingManually(false);
      toast("Horario actualizado", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Error", "error");
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      // exportTutoring trae exceljs (pesado) y los logos embebidos, así que
      // se carga solo al exportar, igual que en AttendanceCard.tsx.
      const { exportScheduleExcel } = await import("@/lib/exportTutoring");
      await exportScheduleExcel({
        courseTitle,
        tutorName,
        programName: programInfo?.programName ?? null,
        subjectName: programInfo?.subjectName ?? null,
        schedule: currentSchedule,
      });
    } catch (e) {
      toast(e instanceof Error ? e.message : "No se pudo exportar", "error");
    } finally {
      setExporting(false);
    }
  };

  const maxVotes = Math.max(0, ...(options ?? []).map((o) => o.votes));

  const addOption = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim()) return;
    try {
      await add.mutateAsync(label.trim());
      setLabel("");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Error", "error");
    }
  };

  const toggle = async (id: string, mine: boolean) => {
    try {
      if (mine) await unvote.mutateAsync(id);
      else await vote.mutateAsync(id);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Error", "error");
    }
  };

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-base font-bold">
            <CalendarClock className="size-4 text-primary" /> Horario del grupo
          </div>
          {isTeacher && (
            <Button size="sm" variant="outline" onClick={handleExport} disabled={exporting}>
              {exporting ? <Spinner className="size-4" /> : <FileDown className="size-4" />}
              Excel
            </Button>
          )}
        </div>

        {editingManually ? (
          <div className="space-y-2">
            <Input
              autoFocus
              value={manualValue}
              onChange={(e) => setManualValue(e.target.value)}
              placeholder="Ej. Lun y Mié 2–4pm, Aula 301"
              onKeyDown={(e) => e.key === "Enter" && saveManual()}
            />
            <div className="flex gap-2">
              <Button size="sm" variant="brand" onClick={saveManual} disabled={settingManually}>
                {settingManually ? <Spinner className="size-4" /> : "Guardar"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setEditingManually(false)}
                disabled={settingManually}
              >
                Cancelar
              </Button>
            </div>
          </div>
        ) : currentSchedule ? (
          <div className="flex items-center gap-2 rounded-xl border border-success/30 bg-success/5 px-3 py-2 text-sm">
            <div className="min-w-0 flex-1">
              <span className="text-muted-foreground">Horario actual: </span>
              <span className="font-semibold text-success">{currentSchedule}</span>
            </div>
            {isTeacher && (
              <button
                onClick={() => {
                  setManualValue(currentSchedule ?? "");
                  setEditingManually(true);
                }}
                className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-muted"
                aria-label="Editar horario"
              >
                <Pencil className="size-4" />
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              {isTeacher
                ? "Propón opciones de horario; tus estudiantes votarán y el más votado queda fijado."
                : "Aún no hay horario. Vota las opciones que puedas cuando tu tutor las proponga."}
            </p>
            {isTeacher && (
              <button
                onClick={() => {
                  setManualValue("");
                  setEditingManually(true);
                }}
                className="text-xs font-semibold text-primary hover:underline"
              >
                ¿Nadie votó o prefieres definirlo tú? Ponlo a mano.
              </button>
            )}
          </div>
        )}

        {/* Tutor: agregar opción */}
        {isTeacher && (
          <form onSubmit={addOption} className="flex gap-2">
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Ej. Lun y Mié 2–4pm"
              className="h-9"
            />
            <Button type="submit" size="sm" variant="brand" disabled={add.isPending}>
              <Plus className="size-4" />
            </Button>
          </form>
        )}

        {/* Opciones + votos */}
        {isLoading ? (
          <Skeleton className="h-10 w-full" />
        ) : !options || options.length === 0 ? (
          <p className="py-2 text-xs text-muted-foreground">
            {isTeacher ? "Aún no propones opciones." : "Tu tutor aún no propone horarios."}
          </p>
        ) : (
          <ul className="space-y-2">
            {options.map((o) => {
              const leading = o.votes > 0 && o.votes === maxVotes;
              return (
                <li
                  key={o.id}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border p-3",
                    leading && "border-success/40 bg-success/5",
                  )}
                >
                  {/* Voto del estudiante (no del tutor) */}
                  {!isTeacher && (
                    <button
                      onClick={() => toggle(o.id, o.mine)}
                      className={cn(
                        "grid size-6 shrink-0 place-items-center rounded-md border transition-colors",
                        o.mine
                          ? "border-primary bg-primary text-white"
                          : "border-border text-transparent hover:border-primary",
                      )}
                      aria-label={o.mine ? "Quitar mi voto" : "Puedo en este horario"}
                    >
                      <Check className="size-4" />
                    </button>
                  )}
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {o.label}
                  </span>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold",
                      leading ? "bg-success/15 text-success" : "bg-muted text-muted-foreground",
                    )}
                  >
                    {o.votes} voto{o.votes === 1 ? "" : "s"}
                  </span>
                  {isTeacher && (
                    <button
                      onClick={() => remove.mutate(o.id)}
                      className="shrink-0 rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      aria-label="Quitar opción"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {!isTeacher && options && options.length > 0 && (
          <p className="text-[11px] text-muted-foreground">
            Marca todas las que puedas. El horario queda en la más votada.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
