import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Users, Copy, ClipboardList } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useCourse, useCourseMembers } from "@/hooks/useCourses";
import { useAssignments } from "@/hooks/useAssignments";
import { AssignmentCard } from "@/components/assignments/AssignmentCard";
import { CreateAssignmentDialog } from "@/components/assignments/CreateAssignmentDialog";
import { useToast } from "@/components/ui/toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/common/EmptyState";
import { COURSE_COLORS } from "@/lib/constants";
import { cn, initials } from "@/lib/utils";
import { FullScreenLoader } from "@/components/common/Spinner";

export function CourseDetailPage() {
  const { id = "" } = useParams();
  const { isTeacher } = useAuth();
  const { toast } = useToast();
  const { data: course, isLoading } = useCourse(id);
  const { data: members, isLoading: membersLoading } = useCourseMembers(
    id,
    isTeacher,
  );
  const { data: assignments, isLoading: assignmentsLoading } =
    useAssignments(id);

  if (isLoading) return <FullScreenLoader />;
  if (!course)
    return (
      <EmptyState
        icon={ClipboardList}
        title="Curso no encontrado"
        description="Puede que haya sido eliminado o no tengas acceso."
        action={
          <Button asChild variant="brand">
            <Link to="/app/courses">Volver a cursos</Link>
          </Button>
        }
      />
    );

  const color = COURSE_COLORS[course.color] ?? COURSE_COLORS.violet;

  return (
    <div className="space-y-6">
      <Link
        to="/app/courses"
        className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Cursos
      </Link>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          "flex flex-col gap-2 rounded-2xl bg-gradient-to-br p-6 text-white surface-glow",
          color.gradient,
        )}
      >
        <h1 className="text-2xl font-extrabold tracking-tight">
          {course.title}
        </h1>
        {course.description && (
          <p className="max-w-prose text-sm text-white/90">
            {course.description}
          </p>
        )}
        {isTeacher && (
          <button
            onClick={() => {
              navigator.clipboard.writeText(course.join_code);
              toast(`Código ${course.join_code} copiado`, "success");
            }}
            className="mt-2 flex w-fit items-center gap-2 rounded-lg bg-white/20 px-3 py-1.5 font-mono text-sm font-semibold backdrop-blur"
          >
            {course.join_code} <Copy className="size-3.5" />
          </button>
        )}
      </motion.div>

      {/* Tareas */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">Tareas</CardTitle>
          {isTeacher && <CreateAssignmentDialog courseId={id} />}
        </CardHeader>
        <CardContent>
          {assignmentsLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : assignments && assignments.length > 0 ? (
            <div className="space-y-3">
              {assignments.map((a, i) => (
                <AssignmentCard key={a.id} assignment={a} index={i} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={ClipboardList}
              title="Sin tareas todavía"
              description={
                isTeacher
                  ? "Crea la primera tarea para tus estudiantes."
                  : "Tu profesor aún no ha publicado tareas."
              }
            />
          )}
        </CardContent>
      </Card>

      {/* Miembros (solo profesor) */}
      {isTeacher && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="size-4" /> Estudiantes ({members?.length ?? 0})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {membersLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))
            ) : members && members.length > 0 ? (
              members.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-muted/50"
                >
                  <Avatar className="size-9">
                    <AvatarImage src={m.avatar_url ?? undefined} />
                    <AvatarFallback>{initials(m.full_name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      {m.full_name}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {m.email}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="px-2 py-4 text-center text-sm text-muted-foreground">
                Aún nadie se ha inscrito. Comparte el código{" "}
                <span className="font-mono font-semibold">
                  {course.join_code}
                </span>
                .
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
