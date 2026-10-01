import { useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { Radio } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useQuizSession } from "@/hooks/useQuiz";
import { useAssignment, useExercises } from "@/hooks/useAssignments";
import { QuizHostView } from "@/components/quiz/QuizHostView";
import { QuizPlayView } from "@/components/quiz/QuizPlayView";
import { EmptyState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";
import { FullScreenLoader } from "@/components/common/Spinner";

export function QuizSessionPage() {
  const { sessionId = "" } = useParams();
  const { isTeacher } = useAuth();
  const { data: session, isLoading: sessionLoading } = useQuizSession(sessionId);
  const { data: assignment } = useAssignment(session?.assignment_id ?? "");
  const { data: exercises, isLoading: exLoading } = useExercises(session?.assignment_id ?? "");

  // Mismo orden que usa el servidor para decidir "pregunta N" (order_index,
  // luego created_at como desempate) — tiene que coincidir exacto. Cuando
  // la sesión tiene orden al azar por estudiante, cada vista resuelve "su"
  // pregunta actual por id contra questionsById en vez de por posición fija
  // en este arreglo canónico.
  const questions = useMemo(
    () =>
      (exercises ?? [])
        .filter((e) => e.type === "multiple_choice")
        .sort(
          (a, b) =>
            a.order_index - b.order_index || a.created_at.localeCompare(b.created_at),
        ),
    [exercises],
  );
  const questionsById = useMemo(
    () => Object.fromEntries(questions.map((q) => [q.id, q])),
    [questions],
  );

  if (sessionLoading || (session && exLoading)) return <FullScreenLoader />;

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <EmptyState
          icon={Radio}
          title="Quiz no encontrado"
          description="Puede que ya haya terminado o no tengas acceso."
          action={
            <Button asChild variant="brand">
              <Link to="/app">Volver al inicio</Link>
            </Button>
          }
        />
      </div>
    );
  }

  if (isTeacher) {
    return (
      <QuizHostView session={session} questions={questions} title={assignment?.title ?? "Quiz"} />
    );
  }
  return (
    <QuizPlayView
      session={session}
      questions={questions}
      questionsById={questionsById}
      title={assignment?.title ?? "Quiz"}
    />
  );
}
