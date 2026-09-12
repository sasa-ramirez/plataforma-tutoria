import { useState, useEffect, useRef } from "react";
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
  LogIn,
  FileUp,
  RotateCcw,
  FileText,
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
  useCoordTeachers,
  useCoordTeacherGroups,
  useAddStudents,
  useRemoveStudent,
} from "@/hooks/useCoordinator";
import {
  fetchStudents,
  fetchTeachers,
  STUDENTS_PAGE_SIZE,
  TEACHERS_PAGE_SIZE,
} from "@/services/coordinator";
import { cn } from "@/lib/utils";
import type { CoordGroup, CoordStudent, CoordTeacher } from "@/services/coordinator";
import {
  fetchTemplateInfo,
  uploadTemplate,
  deleteTemplate,
  findMissingTags,
  findMissingTagsInBuffer,
  requiredTagsFor,
  type TemplateKey,
  type TemplateInfo,
} from "@/services/documentTemplates";
import { autoTagTemplate } from "@/lib/autoTagTemplate";

type Tab = "resumen" | "grupos" | "estudiantes" | "tutores" | "plantillas";

/** "hace un momento / hace 3 días / 12 feb 2026" a partir de un timestamp. */
function timeAgo(iso: string | null): string {
  if (!iso) return "Nunca";
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return "Hace un momento";
  if (min < 60) return `Hace ${min} min`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `Hace ${hr} h`;
  const days = Math.floor(hr / 24);
  if (days < 30) return `Hace ${days} d`;
  return new Date(iso).toLocaleDateString();
}

function scoreColor(s: number | null) {
  if (s == null) return "text-muted-foreground";
  if (s >= 60) return "text-success";
  if (s >= 40) return "text-warning";
  return "text-destructive";
}

/**
 * Descarga el reporte de estudiantes como un .xlsx real (no CSV): así
 * las columnas quedan separadas de verdad sin depender de que el Excel
 * del que lo abre esté configurado en inglés o en español (en español
 * el separador de listas es ";", no ",", y un CSV con comas se ve todo
 * amontonado en una sola columna).
 *
 * La librería (xlsx) pesa bastante, así que se carga solo al exportar
 * (import dinámico) para no engordar el paquete que descarga todo el
 * mundo con solo abrir la app.
 */
async function exportStudentsExcel(students: CoordStudent[]) {
  const XLSX = await import("xlsx");
  const header = [
    "Nombre",
    "Correo",
    "Curso(s)",
    "Entregas",
    "Promedio",
    "XP",
    "Racha",
    "Última actividad",
    "Ingresos",
    "Último ingreso",
  ];
  const rows = students.map((s) => [
    s.full_name ?? "",
    s.email,
    s.course_names ?? "Sin curso",
    s.submissions,
    s.avg_score ?? null,
    s.xp,
    s.streak,
    s.last_active ?? "",
    s.login_count,
    s.last_login ? new Date(s.last_login).toLocaleString() : "",
  ]);

  const sheet = XLSX.utils.aoa_to_sheet([header, ...rows]);
  // Ancho de columna legible (en "caracteres"), no la vista apretada
  // por defecto de una hoja nueva.
  sheet["!cols"] = [
    { wch: 28 },
    { wch: 32 },
    { wch: 34 },
    { wch: 10 },
    { wch: 10 },
    { wch: 8 },
    { wch: 8 },
    { wch: 16 },
    { wch: 10 },
    { wch: 20 },
  ];

  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Estudiantes");
  XLSX.writeFile(book, `estudiantes_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/** Igual que exportStudentsExcel, pero para el reporte de tutores. */
async function exportTeachersExcel(teachers: CoordTeacher[]) {
  const XLSX = await import("xlsx");
  const header = [
    "Nombre",
    "Correo",
    "Grupos",
    "Estudiantes",
    "Entregas",
    "Promedio",
    "Ingresos",
    "Último ingreso",
  ];
  const rows = teachers.map((t) => [
    t.full_name ?? "",
    t.email,
    t.groups,
    t.students,
    t.submissions,
    t.avg_score ?? null,
    t.login_count,
    t.last_login ? new Date(t.last_login).toLocaleString() : "",
  ]);

  const sheet = XLSX.utils.aoa_to_sheet([header, ...rows]);
  sheet["!cols"] = [
    { wch: 28 },
    { wch: 32 },
    { wch: 9 },
    { wch: 12 },
    { wch: 10 },
    { wch: 10 },
    { wch: 10 },
    { wch: 20 },
  ];

  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Tutores");
  XLSX.writeFile(book, `tutores_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export function CoordinationPage() {
  const [tab, setTab] = useState<Tab>("resumen");

  return (
    <div>
      <PageHeader
        title="Coordinación de Tutoría"
        subtitle="Monitorea estudiantes, tutores y grupos. Estadísticas y reportes."
      />

      <div className="mb-5 grid grid-cols-3 gap-2 rounded-xl bg-muted/50 p-1 sm:grid-cols-5">
        {(
          [
            ["resumen", "Resumen"],
            ["grupos", "Grupos"],
            ["estudiantes", "Estudiantes"],
            ["tutores", "Tutores"],
            ["plantillas", "Plantillas"],
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
      {tab === "tutores" && <Tutores />}
      {tab === "plantillas" && <Plantillas />}
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
      await exportStudentsExcel(all.rows);
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
          Exportar Excel
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
              {open === s.student_id && <StudentReport student={s} />}
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

function StudentReport({ student }: { student: CoordStudent }) {
  const { data, isLoading, isError, error } = useCoordStudentSubmissions(student.student_id);
  return (
    <div className="border-t px-4 py-3">
      <div className="mb-3 flex items-center gap-1.5 rounded-lg bg-muted/50 px-3 py-2 text-xs">
        <LogIn className="size-3.5 text-muted-foreground" />
        <span className="font-semibold">{student.login_count}</span>
        <span className="text-muted-foreground">
          ingreso{student.login_count === 1 ? "" : "s"} · último: {timeAgo(student.last_login)}
        </span>
      </div>
      <p className="mb-2 text-xs font-bold text-muted-foreground">Entregas recientes</p>
      {isLoading ? (
        <Skeleton className="h-12 w-full" />
      ) : isError ? (
        <p className="text-xs text-destructive">
          {error instanceof Error ? error.message : "No se pudo cargar."}
        </p>
      ) : !data || data.length === 0 ? (
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

function Tutores() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(0);
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isLoading, isPlaceholderData, isError, error } = useCoordTeachers({
    search: debouncedSearch,
    page,
  });

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / TEACHERS_PAGE_SIZE));
  const from = total === 0 ? 0 : page * TEACHERS_PAGE_SIZE + 1;
  const to = Math.min(total, (page + 1) * TEACHERS_PAGE_SIZE);

  const handleExport = async () => {
    setExporting(true);
    try {
      const all = await fetchTeachers({
        search: debouncedSearch,
        page: 0,
        pageSize: 5000,
      });
      if (all.rows.length === 0) {
        toast("No hay tutores para exportar.", "info");
        return;
      }
      await exportTeachersExcel(all.rows);
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
          Exportar Excel
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
            ? "Ningún tutor coincide con esa búsqueda."
            : "Aún no hay tutores."}
        </p>
      ) : (
        <div
          className={cn(
            "space-y-2 transition-opacity",
            isPlaceholderData && "opacity-60",
          )}
        >
          {rows.map((t) => (
            <Card key={t.teacher_id}>
              <button
                onClick={() => setOpen(open === t.teacher_id ? null : t.teacher_id)}
                className="flex w-full items-center gap-3 p-4 text-left"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{t.full_name ?? "Tutor(a)"}</p>
                  <p className="truncate text-xs text-muted-foreground">{t.email}</p>
                </div>
                <div className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <BookOpen className="size-3.5" /> {t.groups}
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="size-3.5" /> {t.students}
                  </span>
                  <span className={cn("font-bold", scoreColor(t.avg_score))}>
                    {t.avg_score ?? "—"}
                  </span>
                  <ChevronDown
                    className={cn("size-4 transition-transform", open === t.teacher_id && "rotate-180")}
                  />
                </div>
              </button>
              {open === t.teacher_id && <TeacherReport teacher={t} />}
            </Card>
          ))}
        </div>
      )}

      {total > TEACHERS_PAGE_SIZE && (
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

function TeacherReport({ teacher }: { teacher: CoordTeacher }) {
  const { data, isLoading, isError, error } = useCoordTeacherGroups(teacher.teacher_id);
  return (
    <div className="border-t px-4 py-3">
      <div className="mb-3 flex items-center gap-1.5 rounded-lg bg-muted/50 px-3 py-2 text-xs">
        <LogIn className="size-3.5 text-muted-foreground" />
        <span className="font-semibold">{teacher.login_count}</span>
        <span className="text-muted-foreground">
          ingreso{teacher.login_count === 1 ? "" : "s"} · último: {timeAgo(teacher.last_login)}
        </span>
      </div>
      <p className="mb-2 text-xs font-bold text-muted-foreground">Grupos a cargo</p>
      {isLoading ? (
        <Skeleton className="h-12 w-full" />
      ) : isError ? (
        <p className="text-xs text-destructive">
          {error instanceof Error ? error.message : "No se pudo cargar."}
        </p>
      ) : !data || data.length === 0 ? (
        <p className="text-xs text-muted-foreground">Sin grupos todavía.</p>
      ) : (
        <ul className="space-y-1.5">
          {data.map((g) => (
            <li key={g.course_id} className="flex items-center gap-2 text-sm">
              <span className="min-w-0 flex-1 truncate">
                {g.title}
                {g.subject_name && (
                  <span className="text-muted-foreground"> · {g.subject_name}</span>
                )}
              </span>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Users className="size-3.5" /> {g.students}
              </span>
              <Badge variant={g.avg_score != null && g.avg_score >= 60 ? "success" : "secondary"}>
                {g.avg_score ?? "—"}
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Formatos oficiales de Bienestar. Los dos primeros (BS-F-17, AD-F-01)
 * son plantillas activas — la app las rellena automático al generar el
 * informe/acta de cada curso, y valida que traigan los campos correctos
 * antes de aceptar un reemplazo. El resto quedan guardados aquí como
 * copia de referencia del formato vigente, para que el equipo siempre
 * tenga a mano la versión actual.
 */
function Plantillas() {
  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          Plantillas activas
        </p>
        <TemplateSlot
          templateKey="bs-f17"
          title="Informe periódico (BS-F-17)"
          description="Se usa al generar el Word desde “Informe periódico” en cada curso."
          accept=".docx"
        />
        <TemplateSlot
          templateKey="ad-f01"
          title="Acta de reunión (AD-F-01)"
          description="Se usa al generar el Word desde “Actas de reunión” en cada curso."
          accept=".docx"
        />
      </div>

      <div className="space-y-3">
        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          Otros formatos (de referencia)
        </p>
        <TemplateSlot
          templateKey="bs-f51"
          title="Asistencia planificada (BS-F-51)"
          description="Hoja de firmas en papel — se guarda aquí para tenerla siempre a mano."
          accept=".docx"
        />
        <TemplateSlot
          templateKey="bs-f75"
          title="Asistencia ocasional (BS-F-75)"
          description="Hoja de firmas en papel — se guarda aquí para tenerla siempre a mano."
          accept=".docx"
        />
        <TemplateSlot
          templateKey="seguimiento-xlsx"
          title="Formato seguimiento de notas"
          description="Copia de referencia — el Excel que exporta la app se arma aparte."
          accept=".xlsx"
        />
        <TemplateSlot
          templateKey="registro-asistencias-xlsx"
          title="Registro y contabilización de asistencias"
          description="Copia de referencia — el Excel que exporta la app se arma aparte."
          accept=".xlsx"
        />
      </div>
    </div>
  );
}

function TemplateSlot({
  templateKey,
  title,
  description,
  accept,
}: {
  templateKey: TemplateKey;
  title: string;
  description: string;
  accept: string;
}) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [info, setInfo] = useState<TemplateInfo | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      setInfo(await fetchTemplateInfo(templateKey));
    } catch (e) {
      toast(e instanceof Error ? e.message : "No se pudo consultar el archivo", "error");
      setInfo(null);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateKey]);

  const handleFile = async (file: File | null) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(accept)) {
      toast(`Debe ser un archivo ${accept}`, "error");
      return;
    }
    setBusy(true);
    try {
      const requiredTags = requiredTagsFor(templateKey);
      let missing = await findMissingTags(templateKey, file);

      if (missing.length > 0 && requiredTags) {
        // No trae los campos: antes de rechazarlo, se intenta etiquetar
        // solo buscando las etiquetas fijas conocidas ("Lugar:", etc.) —
        // funciona cuando el cambio es de texto/diseño, no de estructura.
        const original = await file.arrayBuffer();
        const autoTagged = await autoTagTemplate(templateKey, original);
        if (autoTagged && autoTagged.applied.length > 0) {
          const stillMissing = await findMissingTagsInBuffer(autoTagged.buffer, requiredTags);
          if (stillMissing.length === 0) {
            const fixedFile = new File([autoTagged.buffer], file.name, { type: file.type });
            await uploadTemplate(templateKey, fixedFile);
            toast(
              `Archivo actualizado — se etiquetó solo (${autoTagged.applied.length} campos encontrados), no hizo falta nada más.`,
              "success",
            );
            await load();
            return;
          }
          missing = stillMissing;
        }

        toast(
          `No se subió: al archivo le faltan estos campos — ${missing.join(", ")}.`,
          "error",
        );
        return;
      }

      if (missing.length > 0) {
        toast(`No se subió: al archivo le faltan estos campos — ${missing.join(", ")}.`, "error");
        return;
      }

      await uploadTemplate(templateKey, file);
      toast("Archivo actualizado", "success");
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "No se pudo subir", "error");
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleReset = async () => {
    if (!window.confirm("¿Quitar este archivo?")) return;
    setBusy(true);
    try {
      await deleteTemplate(templateKey);
      toast("Archivo eliminado", "success");
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "No se pudo eliminar", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <div className="space-y-3 p-4">
        <div className="flex items-center gap-2">
          <FileText className="size-4 text-primary" />
          <div className="min-w-0">
            <p className="font-bold">{title}</p>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
        </div>

        {info === undefined ? (
          <Skeleton className="h-10 w-full" />
        ) : info ? (
          <div className="rounded-xl border border-success/30 bg-success/5 px-3 py-2 text-xs">
            <span className="font-semibold text-success">Subido</span>
            <span className="text-muted-foreground">
              {" "}
              · actualizado {timeAgo(info.updatedAt)} · {(info.sizeBytes / 1024).toFixed(0)} KB
            </span>
          </div>
        ) : (
          <p className="rounded-xl border px-3 py-2 text-xs text-muted-foreground">
            Nadie ha subido nada todavía.
          </p>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="brand"
            onClick={() => fileInputRef.current?.click()}
            disabled={busy}
          >
            {busy ? <Spinner className="size-4" /> : <FileUp className="size-4" />}
            Subir nuevo
          </Button>
          {info && (
            <Button size="sm" variant="outline" onClick={handleReset} disabled={busy}>
              <RotateCcw className="size-4" /> Quitar
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
