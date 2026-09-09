import { useState, useEffect } from "react";
import {
  Users,
  GraduationCap,
  BookOpen,
  ClipboardList,
  Send,
  Star,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Flame,
  Clock,
  Copy,
  UserPlus,
  UserX,
  Download,
  Search,
} from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/common/StatCard";
import { Spinner } from "@/components/common/Spinner";
import { useToast } from "@/components/ui/toast";
import { CreateGroupDialog } from "@/components/coordinator/CreateGroupDialog";
import {
  useCoordOverview,
  useCoordGroups,
  useCoordGroupAssignments,
  useCoordStudents,
  useCoordStudentSubmissions,
  useCoordGroupStudents,
  useAddStudents,
  useRemoveStudent,
} from "@/hooks/useCoordinator";
import { fetchStudents, STUDENTS_PAGE_SIZE } from "@/services/coordinator";
import { cn } from "@/lib/utils";
import type { CoordGroup, CoordStudent } from "@/services/coordinator";

type Tab = "resumen" | "grupos" | "estudiantes";

function scoreColor(s: number | null) {
  if (s == null) return "text-muted-foreground";
  if (s >= 60) return "text-success";
  if (s >= 40) return "text-warning";
  return "text-destructive";
}

/** Descarga el reporte de estudiantes como CSV (se abre bien en Excel/Sheets). */
function exportStudentsCSV(students: CoordStudent[]) {
  const header = [
    "Nombre",
    "Correo",
    "Cursos",
    "Entregas",
    "Promedio",
    "XP",
    "Racha",
    "Última actividad",
  ];
  const rows = students.map((s) => [
    s.full_name ?? "",
    s.email,
    s.courses,
    s.submissions,
    s.avg_score ?? "",
    s.xp,
    s.streak,
    s.last_active ?? "",
  ]);
  // Los números van sin comillas: así Excel/Sheets los reconoce como
  // números de verdad (se pueden sumar/ordenar), no como texto.
  const cell = (v: unknown) => {
    if (typeof v === "number") return String(v);
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [header, ...rows].map((r) => r.map(cell).join(",")).join("\n");
  // BOM al inicio para que Excel detecte UTF-8 y no rompa tildes/ñ.
  const blob = new Blob([String.fromCharCode(0xfeff) + csv], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `estudiantes_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function CoordinationPage() {
  const [tab, setTab] = useState<Tab>("resumen");

  return (
    <div>
      <PageHeader
        title="Coordinación de Tutoría"
        subtitle="Monitorea estudiantes, tutores y grupos. Estadísticas y reportes."
      />

      <div className="mb-5 grid grid-cols-3 gap-2 rounded-xl bg-muted/50 p-1">
        {(
          [
            ["resumen", "Resumen"],
            ["grupos", "Grupos"],
            ["estudiantes", "Estudiantes"],
          ] as [Tab, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              "rounded-lg py-2 text-sm font-semibold transition-colors",
              tab === id ? "bg-card text-foreground shadow" : "text-muted-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "resumen" && <Resumen />}
      {tab === "grupos" && <Grupos />}
      {tab === "estudiantes" && <Estudiantes />}
    </div>
  );
}

function Resumen() {
  const { data, isLoading } = useCoordOverview();
  if (isLoading)
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  if (!data) return null;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      <StatCard icon={Users} label="Estudiantes" value={data.students} />
      <StatCard icon={GraduationCap} label="Tutores" value={data.teachers} />
      <StatCard icon={BookOpen} label="Grupos" value={data.courses} />
      <StatCard icon={ClipboardList} label="Tareas" value={data.assignments} />
      <StatCard icon={Send} label="Entregas" value={data.submissions} />
      <StatCard icon={Star} label="Promedio" value={`${data.avg_score}/100`} />
    </div>
  );
}

function Grupos() {
  const { data, isLoading } = useCoordGroups();
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold">Grupos de tutoría</p>
        <CreateGroupDialog />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : !data || data.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Aún no hay grupos. Crea el primero con "Crear grupo".
        </p>
      ) : (
        <div className="space-y-2">
          {data.map((g) => (
            <Card key={g.course_id}>
              <button
                onClick={() => setOpen(open === g.course_id ? null : g.course_id)}
                className="flex w-full items-center gap-3 p-4 text-left"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{g.title}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {g.teacher_name ?? "Sin tutor"}
                    {g.subject_name ? ` · ${g.subject_name}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Users className="size-3.5" /> {g.students}
                  </span>
                  <span className="flex items-center gap-1">
                    <ClipboardList className="size-3.5" /> {g.assignments}
                  </span>
                  <span className={cn("font-bold", scoreColor(g.avg_score))}>
                    {g.avg_score ?? "—"}
                  </span>
                  <ChevronDown
                    className={cn(
                      "size-4 transition-transform",
                      open === g.course_id && "rotate-180",
                    )}
                  />
                </div>
              </button>
              {open === g.course_id && <GroupDetail group={g} />}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function GroupDetail({ group }: { group: CoordGroup }) {
  const { toast } = useToast();
  return (
    <div className="space-y-4 border-t p-4">
      {/* Horario + código */}
      <div className="flex flex-wrap items-center gap-3 text-xs">
        {group.schedule && (
          <span className="flex items-center gap-1 text-muted-foreground">
            <Clock className="size-3.5" /> {group.schedule}
          </span>
        )}
        {group.join_code && (
          <button
            onClick={() => {
              navigator.clipboard.writeText(group.join_code as string);
              toast(`Código ${group.join_code} copiado`, "success");
            }}
            className="flex items-center gap-1 rounded-lg bg-muted px-2 py-1 font-mono font-semibold"
          >
            {group.join_code} <Copy className="size-3" />
          </button>
        )}
      </div>

      <GroupStudents courseId={group.course_id} />
      <AddStudents courseId={group.course_id} />
      <GroupTasks courseId={group.course_id} />
    </div>
  );
}

function GroupStudents({ courseId }: { courseId: string }) {
  const { toast } = useToast();
  const { data, isLoading } = useCoordGroupStudents(courseId);
  const { mutateAsync: remove, isPending } = useRemoveStudent(courseId);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const handleRemove = async (studentId: string, name: string | null) => {
    if (!window.confirm(`¿Quitar a ${name ?? "este estudiante"} del grupo?`))
      return;
    setRemovingId(studentId);
    try {
      await remove(studentId);
      toast("Estudiante removido del grupo", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "No se pudo quitar", "error");
    } finally {
      setRemovingId(null);
    }
  };

  if (isLoading) return <Skeleton className="h-10 w-full" />;
  if (!data || data.length === 0)
    return (
      <p className="text-xs text-muted-foreground">
        Aún no hay estudiantes en este grupo.
      </p>
    );

  return (
    <div className="space-y-2">
      <p className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
        <Users className="size-3.5" /> Estudiantes del grupo ({data.length})
      </p>
      <div className="space-y-1.5">
        {data.map((s) => (
          <div
            key={s.student_id}
            className="flex items-center gap-2 rounded-lg border px-2.5 py-1.5"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {s.full_name ?? "Estudiante"}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {s.email}
              </p>
            </div>
            <span className={cn("shrink-0 text-xs font-bold", scoreColor(s.avg_score))}>
              {s.avg_score ?? "—"}
            </span>
            <button
              onClick={() => handleRemove(s.student_id, s.full_name)}
              disabled={isPending && removingId === s.student_id}
              className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
              aria-label={`Quitar a ${s.full_name ?? "estudiante"} del grupo`}
            >
              {isPending && removingId === s.student_id ? (
                <Spinner className="size-4" />
              ) : (
                <UserX className="size-4" />
              )}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function AddStudents({ courseId }: { courseId: string }) {
  const { toast } = useToast();
  const { mutateAsync, isPending } = useAddStudents(courseId);
  const [emails, setEmails] = useState("");

  const submit = async () => {
    const list = emails
      .split(/[\s,;]+/)
      .map((e) => e.trim())
      .filter(Boolean);
    if (list.length === 0) return;
    try {
      const r = await mutateAsync(list);
      let msg = `${r.added} estudiante(s) agregado(s) y notificado(s).`;
      if (r.missing.length) msg += ` Sin cuenta: ${r.missing.join(", ")}.`;
      toast(msg, r.missing.length ? "info" : "success");
      if (r.missing.length === 0) setEmails("");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Error", "error");
    }
  };

  return (
    <div className="space-y-2">
      <p className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
        <UserPlus className="size-3.5" /> Agregar estudiantes (por correo)
      </p>
      <Textarea
        value={emails}
        onChange={(e) => setEmails(e.target.value)}
        placeholder="Pega los correos separados por coma, espacio o salto de línea…"
        className="min-h-[70px] text-sm"
      />
      <Button size="sm" variant="brand" onClick={submit} disabled={isPending}>
        {isPending ? <Spinner className="size-4" /> : "Agregar y avisar"}
      </Button>
    </div>
  );
}

function GroupTasks({ courseId }: { courseId: string }) {
  const { data, isLoading } = useCoordGroupAssignments(courseId);
  if (isLoading)
    return <div className="px-4 pb-4"><Skeleton className="h-12 w-full" /></div>;
  return (
    <div className="border-t px-4 py-3">
      <p className="mb-2 text-xs font-bold text-muted-foreground">Tareas del grupo</p>
      {!data || data.length === 0 ? (
        <p className="text-xs text-muted-foreground">Sin tareas todavía.</p>
      ) : (
        <ul className="space-y-1.5">
          {data.map((a) => (
            <li key={a.id} className="flex items-center gap-2 text-sm">
              <span className="min-w-0 flex-1 truncate">{a.title}</span>
              <Badge variant="secondary">{a.exercises} ej.</Badge>
              <Badge variant={a.status === "open" ? "success" : "secondary"}>
                {a.status}
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Estudiantes() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const { toast } = useToast();

  // Espera a que dejen de escribir antes de buscar (evita una consulta
  // por cada letra) y vuelve a la primera página en cada búsqueda nueva.
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(0);
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isLoading, isPlaceholderData, isError, error } = useCoordStudents({
    search: debouncedSearch,
    page,
  });

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / STUDENTS_PAGE_SIZE));
  const from = total === 0 ? 0 : page * STUDENTS_PAGE_SIZE + 1;
  const to = Math.min(total, (page + 1) * STUDENTS_PAGE_SIZE);

  // El CSV exporta TODO lo que calza con la búsqueda actual, no solo la
  // página visible — por eso pide aparte, con un límite grande, en vez
  // de reusar los 20 que ya están en pantalla.
  const handleExport = async () => {
    setExporting(true);
    try {
      const all = await fetchStudents({
        search: debouncedSearch,
        page: 0,
        pageSize: 5000,
      });
      if (all.rows.length === 0) {
        toast("No hay estudiantes para exportar.", "info");
        return;
      }
      exportStudentsCSV(all.rows);
    } catch (e) {
      toast(e instanceof Error ? e.message : "No se pudo exportar", "error");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre o correo…"
            className="pl-9"
          />
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={handleExport}
          disabled={exporting}
          className="shrink-0"
        >
          {exporting ? <Spinner className="size-4" /> : <Download className="size-4" />}
          Exportar CSV
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : isError ? (
        <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-center text-sm text-destructive">
          {error instanceof Error ? error.message : "No se pudo cargar la lista."}
        </p>
      ) : rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {debouncedSearch
            ? "Ningún estudiante coincide con esa búsqueda."
            : "Aún no hay estudiantes."}
        </p>
      ) : (
        <div
          className={cn(
            "space-y-2 transition-opacity",
            isPlaceholderData && "opacity-60",
          )}
        >
          {rows.map((s) => (
            <Card key={s.student_id}>
              <button
                onClick={() => setOpen(open === s.student_id ? null : s.student_id)}
                className="flex w-full items-center gap-3 p-4 text-left"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{s.full_name ?? "Estudiante"}</p>
                  <p className="truncate text-xs text-muted-foreground">{s.email}</p>
                </div>
                <div className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <BookOpen className="size-3.5" /> {s.courses}
                  </span>
                  <span className="flex items-center gap-1">
                    <Flame className="size-3.5 text-warning" /> {s.streak}
                  </span>
                  <span className={cn("font-bold", scoreColor(s.avg_score))}>
                    {s.avg_score ?? "—"}
                  </span>
                  <ChevronDown
                    className={cn("size-4 transition-transform", open === s.student_id && "rotate-180")}
                  />
                </div>
              </button>
              {open === s.student_id && <StudentReport studentId={s.student_id} />}
            </Card>
          ))}
        </div>
      )}

      {total > STUDENTS_PAGE_SIZE && (
        <div className="flex items-center justify-between pt-1 text-sm text-muted-foreground">
          <span>
            {from}–{to} de {total}
          </span>
          <div className="flex items-center gap-2">
            <Button
              size="icon"
              variant="outline"
              className="size-8"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              aria-label="Página anterior"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span className="tabular-nums">
              {page + 1} / {totalPages}
            </span>
            <Button
              size="icon"
              variant="outline"
              className="size-8"
              disabled={page + 1 >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              aria-label="Página siguiente"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function StudentReport({ studentId }: { studentId: string }) {
  const { data, isLoading } = useCoordStudentSubmissions(studentId);
  if (isLoading)
    return <div className="px-4 pb-4"><Skeleton className="h-12 w-full" /></div>;
  return (
    <div className="border-t px-4 py-3">
      <p className="mb-2 text-xs font-bold text-muted-foreground">Entregas recientes</p>
      {!data || data.length === 0 ? (
        <p className="text-xs text-muted-foreground">Sin entregas todavía.</p>
      ) : (
        <ul className="space-y-1.5">
          {data.map((sub, i) => (
            <li key={i} className="flex items-center gap-2 text-sm">
              <span className="min-w-0 flex-1 truncate">
                {sub.exercise_title}
                {sub.course_title ? (
                  <span className="text-muted-foreground"> · {sub.course_title}</span>
                ) : (
                  <span className="text-muted-foreground"> · Práctica</span>
                )}
              </span>
              {sub.score != null ? (
                <Badge variant={sub.score >= 60 ? "success" : "warning"}>{sub.score}</Badge>
              ) : (
                <Badge variant="secondary">{sub.status}</Badge>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
