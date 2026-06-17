import { useState } from "react";
import { CalendarClock, Plus, Trash2, Check } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { useScheduleOptions, useScheduleMutations } from "@/hooks/useSchedule";
import { cn } from "@/lib/utils";

/**
 * Cuadrar horario: el tutor propone opciones y los estudiantes votan las que
 * pueden. El horario del grupo queda automáticamente en la MÁS votada.
 */
export function ScheduleCard({
  courseId,
  isTeacher,
  currentSchedule,
}: {
  courseId: string;
  isTeacher: boolean;
  currentSchedule: string | null;
}) {
  const { toast } = useToast();
  const { data: options, isLoading } = useScheduleOptions(courseId);
  const { add, remove, vote, unvote } = useScheduleMutations(courseId);
  const [label, setLabel] = useState("");

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
        <div className="flex items-center gap-1.5 text-base font-bold">
          <CalendarClock className="size-4 text-primary" /> Horario del grupo
        </div>

        {currentSchedule ? (
          <div className="rounded-xl border border-success/30 bg-success/5 px-3 py-2 text-sm">
            <span className="text-muted-foreground">Horario actual: </span>
            <span className="font-semibold text-success">{currentSchedule}</span>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            {isTeacher
              ? "Propón opciones de horario; tus estudiantes votarán y el más votado queda fijado."
              : "Aún no hay horario. Vota las opciones que puedas cuando tu tutor las proponga."}
          </p>
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
