import { useState } from "react";
import {
  Users,
  GraduationCap,
  BookOpen,
  ClipboardList,
  Send,
  Star,
  ChevronDown,
  Flame,
} from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/common/StatCard";
import {
  useCoordOverview,
  useCoordGroups,
  useCoordGroupAssignments,
  useCoordStudents,
  useCoordStudentSubmissions,
} from "@/hooks/useCoordinator";
import { cn } from "@/lib/utils";

type Tab = "resumen" | "grupos" | "estudiantes";

function scoreColor(s: number | null) {
  if (s == null) return "text-muted-foreground";
  if (s >= 60) return "text-success";
  if (s >= 40) return "text-warning";
  return "text-destructive";
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

  if (isLoading)
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  if (!data || data.length === 0)
    return <p className="py-8 text-center text-sm text-muted-foreground">Aún no hay grupos.</p>;

  return (
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
                className={cn("size-4 transition-transform", open === g.course_id && "rotate-180")}
              />
            </div>
          </button>
          {open === g.course_id && <GroupTasks courseId={g.course_id} />}
        </Card>
      ))}
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
  const { data, isLoading } = useCoordStudents();
  const [open, setOpen] = useState<string | null>(null);

  if (isLoading)
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  if (!data || data.length === 0)
    return <p className="py-8 text-center text-sm text-muted-foreground">Aún no hay estudiantes.</p>;

  return (
    <div className="space-y-2">
      {data.map((s) => (
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
