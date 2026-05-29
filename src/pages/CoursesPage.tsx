import { BookOpen } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useCourses } from "@/hooks/useCourses";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { CourseCard } from "@/components/courses/CourseCard";
import { CreateCourseDialog } from "@/components/courses/CreateCourseDialog";
import { JoinCourseDialog } from "@/components/courses/JoinCourseDialog";
import { Skeleton } from "@/components/ui/skeleton";
import type { CourseWithMeta } from "@/services/courses";

export function CoursesPage() {
  const { isTeacher } = useAuth();
  const { data: courses, isLoading, isError } = useCourses();

  return (
    <div>
      <PageHeader
        title="Cursos"
        subtitle={
          isTeacher
            ? "Crea cursos y comparte el código de acceso."
            : "Únete a un curso con el código de tu profe."
        }
        action={isTeacher ? <CreateCourseDialog /> : <JoinCourseDialog />}
      />

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-36 w-full" />
          ))}
        </div>
      ) : isError ? (
        <EmptyState
          icon={BookOpen}
          title="No se pudieron cargar los cursos"
          description="Revisa tu conexión o la configuración de Supabase e inténtalo de nuevo."
        />
      ) : !courses || courses.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="Aún no hay cursos"
          description={
            isTeacher
              ? "Crea tu primer curso para empezar a publicar tareas."
              : "Pide a tu profesor el código del curso y únete."
          }
          action={isTeacher ? <CreateCourseDialog /> : <JoinCourseDialog />}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {courses.map((course, i) => (
            <CourseCard
              key={course.id}
              course={course}
              studentCount={(course as CourseWithMeta).student_count}
              isTeacher={isTeacher}
              index={i}
            />
          ))}
        </div>
      )}
    </div>
  );
}
