import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ClipboardCheck,
  Plus,
  ChevronDown,
  Trash2,
  Search,
  X,
  UserCheck,
  UserX as UserXIcon,
} from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/common/Spinner";
import { useToast } from "@/components/ui/toast";
import { useCourseMembers } from "@/hooks/useCourses";
import {
  useTutoringSessions,
  useCreateSession,
  useDeleteSession,
  useSessionAttendance,
} from "@/hooks/useTutoring";
import { searchStudents, type StudentSearchResult } from "@/services/tutoring";
import { cn, initials } from "@/lib/utils";
import type { TutoringSessionType } from "@/types/database";

const todayStr = () => new Date().toISOString().slice(0, 10);

export function AttendanceCard({ courseId }: { courseId: string }) {
  const { data: sessions, isLoading } = useTutoringSessions(courseId);
  const [openSession, setOpenSession] = useState<string | null>(null);

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-base font-bold">
            <ClipboardCheck className="size-4 text-primary" /> Asistencia de tutorías
          </div>
          <NewSessionDialog courseId={courseId} />
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : !sessions || sessions.length === 0 ? (
          <p className="py-2 text-xs text-muted-foreground">
            Aún no registras sesiones. Cuando dictes una tutoría, regístrala
            aquí con "Nueva sesión".
          </p>
        ) : (
          <div className="space-y-2">
            {sessions.map((s) => (
              <SessionRow
                key={s.id}
                session={s}
                courseId={courseId}
                open={openSession === s.id}
                onToggle={() =>
                  setOpenSession(openSession === s.id ? null : s.id)
                }
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SessionRow({
  session,
  courseId,
  open,
  onToggle,
}: {
  session: {
    id: string;
    session_date: string;
    type: TutoringSessionType;
    topic: string | null;
    present_count: number;
    total_count: number;
  };
  courseId: string;
  open: boolean;
  onToggle: () => void;
}) {
  const { toast } = useToast();
  const { mutateAsync: remove, isPending } = useDeleteSession(courseId);
  const { data: attendance, isLoading } = useSessionAttendance(
    open ? session.id : null,
  );

  const handleDelete = async () => {
    if (!window.confirm("¿Eliminar esta sesión y su asistencia?")) return;
    try {
      await remove(session.id);
      toast("Sesión eliminada", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "No se pudo eliminar", "error");
    }
  };

  return (
    <div className="rounded-xl border">
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-3 py-2.5 text-left"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold">
              {new Date(session.session_date + "T00:00:00").toLocaleDateString(
                "es-CO",
                { day: "2-digit", month: "short", year: "numeric" },
              )}
            </p>
            <Badge variant={session.type === "planificada" ? "default" : "secondary"}>
              {session.type === "planificada" ? "Planificada" : "Ocasional"}
            </Badge>
          </div>
          {session.topic && (
            <p className="truncate text-xs text-muted-foreground">
              {session.topic}
            </p>
          )}
        </div>
        <span className="shrink-0 text-xs font-semibold text-muted-foreground">
          {session.present_count}/{session.total_count} presentes
        </span>
        <ChevronDown
          className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t"
          >
            <div className="space-y-2 p-3">
              {isLoading ? (
                <Skeleton className="h-10 w-full" />
              ) : !attendance || attendance.length === 0 ? (
                <p className="text-xs text-muted-foreground">Sin registros.</p>
              ) : (
                <ul className="space-y-1">
                  {attendance.map((a) => (
                    <li
                      key={a.student_id}
                      className="flex items-center gap-2 text-sm"
                    >
                      {a.present ? (
                        <UserCheck className="size-3.5 shrink-0 text-success" />
                      ) : (
                        <UserXIcon className="size-3.5 shrink-0 text-destructive" />
                      )}
                      <span className="min-w-0 flex-1 truncate">
                        {a.full_name ?? a.email}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={handleDelete}
                disabled={isPending}
              >
                <Trash2 className="size-4" /> Eliminar sesión
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function NewSessionDialog({ courseId }: { courseId: string }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(todayStr());
  const [type, setType] = useState<TutoringSessionType>("planificada");
  const [topic, setTopic] = useState("");
  const [absentIds, setAbsentIds] = useState<Set<string>>(new Set());
  const [picked, setPicked] = useState<StudentSearchResult[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<StudentSearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  const { data: members, isLoading: membersLoading } = useCourseMembers(
    courseId,
    open && type === "planificada",
  );
  const { mutateAsync: create, isPending } = useCreateSession(courseId);

  // Búsqueda de estudiantes (ocasional), con debounce.
  useEffect(() => {
    if (type !== "ocasional" || !query.trim()) {
      setResults([]);
      return;
    }
    let active = true;
    setSearching(true);
    const t = setTimeout(() => {
      searchStudents(query)
        .then((r) => {
          if (active) setResults(r);
        })
        .catch(() => {})
        .finally(() => {
          if (active) setSearching(false);
        });
    }, 300);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [query, type]);

  const reset = () => {
    setDate(todayStr());
    setType("planificada");
    setTopic("");
    setAbsentIds(new Set());
    setPicked([]);
    setQuery("");
    setResults([]);
  };

  const submit = async () => {
    const attendance =
      type === "planificada"
        ? (members ?? []).map((m) => ({
            student_id: m.id,
            present: !absentIds.has(m.id),
          }))
        : picked.map((p) => ({ student_id: p.id, present: true }));

    if (attendance.length === 0) {
      toast(
        type === "planificada"
          ? "Este grupo todavía no tiene estudiantes inscritos."
          : "Agrega al menos un estudiante.",
        "error",
      );
      return;
    }

    try {
      await create({ sessionDate: date, type, topic, attendance });
      toast("Sesión registrada", "success");
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
          <Plus className="size-4" /> Nueva sesión
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Registrar sesión de tutoría</DialogTitle>
          <DialogDescription>
            Marca quién asistió. Queda guardado con la fecha de hoy.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="sess-date">Fecha</Label>
              <Input
                id="sess-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                max={todayStr()}
              />
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <div className="flex rounded-xl bg-muted/50 p-1">
                {(
                  [
                    ["planificada", "Planificada"],
                    ["ocasional", "Ocasional"],
                  ] as [TutoringSessionType, string][]
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setType(id)}
                    className={cn(
                      "flex-1 rounded-lg py-1.5 text-xs font-semibold transition-colors",
                      type === id
                        ? "bg-card text-foreground shadow"
                        : "text-muted-foreground",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sess-topic">Temas desarrollados (opcional)</Label>
            <Textarea
              id="sess-topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Ej. condicionales, switch, ciclos…"
              className="min-h-[60px] text-sm"
            />
          </div>

          {type === "planificada" ? (
            <div className="space-y-2">
              <Label>Asistencia del grupo</Label>
              {membersLoading ? (
                <Skeleton className="h-24 w-full" />
              ) : !members || members.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Este grupo todavía no tiene estudiantes inscritos.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {members.map((m) => {
                    const absent = absentIds.has(m.id);
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() =>
                          setAbsentIds((prev) => {
                            const next = new Set(prev);
                            if (next.has(m.id)) next.delete(m.id);
                            else next.add(m.id);
                            return next;
                          })
                        }
                        className={cn(
                          "flex w-full items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left text-sm transition-colors",
                          absent
                            ? "border-destructive/30 bg-destructive/5"
                            : "border-success/30 bg-success/5",
                        )}
                      >
                        {absent ? (
                          <UserXIcon className="size-4 shrink-0 text-destructive" />
                        ) : (
                          <UserCheck className="size-4 shrink-0 text-success" />
                        )}
                        <span className="min-w-0 flex-1 truncate">
                          {m.full_name ?? m.email}
                        </span>
                        <span
                          className={cn(
                            "shrink-0 text-xs font-semibold",
                            absent ? "text-destructive" : "text-success",
                          )}
                        >
                          {absent ? "Ausente" : "Presente"}
                        </span>
                      </button>
                    );
                  })}
                  <p className="text-[11px] text-muted-foreground">
                    Todos empiezan como presentes — toca al que faltó.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Estudiante(s)</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar por nombre o correo…"
                  className="pl-9"
                />
              </div>
              {searching && <Skeleton className="h-9 w-full" />}
              {results.length > 0 && (
                <div className="space-y-1 rounded-xl border p-1.5">
                  {results
                    .filter((r) => !picked.some((p) => p.id === r.id))
                    .map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => {
                          setPicked((prev) => [...prev, r]);
                          setQuery("");
                          setResults([]);
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-muted"
                      >
                        <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                          {initials(r.full_name)}
                        </span>
                        <span className="min-w-0 flex-1 truncate">
                          {r.full_name ?? r.email}
                        </span>
                      </button>
                    ))}
                </div>
              )}
              {picked.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {picked.map((p) => (
                    <span
                      key={p.id}
                      className="flex items-center gap-1 rounded-full bg-primary/10 py-1 pl-3 pr-1.5 text-xs font-semibold text-primary"
                    >
                      {p.full_name ?? p.email}
                      <button
                        type="button"
                        onClick={() =>
                          setPicked((prev) => prev.filter((x) => x.id !== p.id))
                        }
                        className="rounded-full p-0.5 hover:bg-primary/20"
                        aria-label={`Quitar a ${p.full_name ?? p.email}`}
                      >
                        <X className="size-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          <Button
            variant="brand"
            className="w-full"
            onClick={submit}
            disabled={isPending}
          >
            {isPending ? <Spinner className="size-4" /> : "Guardar sesión"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
