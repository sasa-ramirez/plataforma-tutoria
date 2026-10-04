import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { FileText } from "lucide-react";
import { useCoordGroupQuizData } from "@/hooks/useCoordinator";
import { EmptyState } from "@/components/common/EmptyState";
import { FullScreenLoader } from "@/components/common/Spinner";
import { Button } from "@/components/ui/button";
import { ConsolidatedView } from "@/components/quiz/ConsolidatedView";
import { buildConsolidated } from "@/lib/quizConsolidated";

/** Informe de quizzes en vivo de UN grupo, para el coordinador: participación
 * por quiz, lo mejor de cada estudiante y sus falencias. Imprimible / CSV. */
export function CoordGroupQuizPage() {
  const { courseId = "" } = useParams();
  const { data, isLoading, isError, error } = useCoordGroupQuizData(courseId);
  const c = useMemo(() => (data ? buildConsolidated(data) : null), [data]);

  if (isLoading) return <FullScreenLoader />;
  if (isError || !c || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <EmptyState
          icon={FileText}
          title="No se pudo cargar el informe"
          description={error instanceof Error ? error.message : "Intenta de nuevo."}
          action={
            <Button asChild variant="brand">
              <Link to="/app/coordinacion">Volver a Coordinación</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <ConsolidatedView
      c={c}
      courseTitle={data.course_title}
      backTo="/app/coordinacion"
      backLabel="Volver a Coordinación"
    />
  );
}
