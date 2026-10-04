import { useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { FileText, Lock } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useCourseQuizData } from "@/hooks/useQuiz";
import { useCourse } from "@/hooks/useCourses";
import { EmptyState } from "@/components/common/EmptyState";
import { FullScreenLoader } from "@/components/common/Spinner";
import { Button } from "@/components/ui/button";
import { ConsolidatedView } from "@/components/quiz/ConsolidatedView";
import { buildConsolidated } from "@/lib/quizConsolidated";

/** Consolidado del curso: lo mejor de cada estudiante entre todos sus quizzes,
 * con sus fortalezas y falencias por tema. Imprimible / exportable. */
export function QuizConsolidatedPage() {
  const { courseId = "" } = useParams();
  const { isTeacher } = useAuth();
  const { data: course } = useCourse(courseId);
  const { data, isLoading, isError, error } = useCourseQuizData(courseId);
  const c = useMemo(() => (data ? buildConsolidated(data) : null), [data]);

  if (!isTeacher) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <EmptyState
          icon={Lock}
          title="Solo el profesor puede ver esto"
          description="El consolidado es para el profesor dueño del curso."
          action={
            <Button asChild variant="brand">
              <Link to="/app">Volver al inicio</Link>
            </Button>
          }
        />
      </div>
    );
  }
  if (isLoading) return <FullScreenLoader />;
  if (isError || !c) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <EmptyState
          icon={FileText}
          title="No se pudo cargar el consolidado"
          description={error instanceof Error ? error.message : "Intenta de nuevo."}
          action={
            <Button asChild variant="brand">
              <Link to={`/app/courses/${courseId}`}>Volver al curso</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <ConsolidatedView
      c={c}
      courseTitle={course?.title}
      backTo={`/app/courses/${courseId}`}
      backLabel="Volver al curso"
    />
  );
}
