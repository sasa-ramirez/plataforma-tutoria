import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, BarChart3, CheckCircle2, ChevronDown, Lock, Medal, XCircle } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import {
  useQuizSession,
  useQuizParticipants,
  useQuizSessionStats,
  useQuizParticipantDetail,
} from "@/hooks/useQuiz";
import { useAssignment } from "@/hooks/useAssignments";
import { EmptyState } from "@/components/common/EmptyState";
import { FullScreenLoader, Spinner } from "@/components/common/Spinner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const MEDAL_COLOR = ["text-warning", "text-muted-foreground", "text-orange-700"];

/** Resultados de un quiz terminado (o en curso): precisión por pregunta y
 * el detalle de cada estudiante. Solo el profesor dueño del curso. */
export function QuizResultsPage() {
  const { sessionId = "" } = useParams();
  const { isTeacher } = useAuth();
  const { data: session, isLoading: sessionLoading } = useQuizSession(sessionId);
  const { data: assignment } = useAssignment(session?.assignment_id ?? "");
  const { data: participants, isLoading: partsLoading } = useQuizParticipants(sessionId);
  const { data: stats, isLoading: statsLoading } = useQuizSessionStats(sessionId);
  const [openParticipant, setOpenParticipant] = useState<string | null>(null);

  if (sessionLoading) return <FullScreenLoader />;

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <EmptyState
          icon={BarChart3}
          title="Quiz no encontrado"
          description="Puede que no tengas acceso o el enlace esté mal."
          action={
            <Button asChild variant="brand">
              <Link to="/app">Volver al inicio</Link>
            </Button>
          }
        />
      </div>
    );
  }

  if (!isTeacher) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <EmptyState
          icon={Lock}
          title="Solo el profesor puede ver esto"
          description="Si eres estudiante, tus propias respuestas aparecen en la pantalla final del quiz."
          action={
            <Button asChild variant="brand">
              <Link to="/app">Volver al inicio</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      <Link
        to={`/app/assignments/${session.assignment_id}`}
        className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Volver a la tarea
      </Link>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Resultados del quiz · {session.mode === "sync" ? "al mismo tiempo" : "a su ritmo"}
          {session.shuffle && " · orden aleatorio"}
        </p>
        <h1 className="text-xl font-extrabold">{assignment?.title ?? "Quiz"}</h1>
      </div>

      {/* Precisión por pregunta */}
      <Card>
        <CardContent className="space-y-3 p-4">
          <p className="flex items-center gap-1.5 text-sm font-bold text-muted-foreground">
            <BarChart3 className="size-4" /> Por pregunta
          </p>
          {statsLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : !stats || stats.length === 0 ? (
            <p className="py-3 text-center text-xs text-muted-foreground">
              Todavía no hay respuestas.
            </p>
          ) : (
            stats.map((q, i) => {
              const pct = q.total_answers > 0 ? Math.round((q.correct_answers / q.total_answers) * 100) : 0;
              return (
                <div key={q.exercise_id} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="truncate font-semibold">
                      {i + 1}. {q.title}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {q.correct_answers}/{q.total_answers} · {pct}%
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn(
                        "h-full rounded-full",
                        pct >= 70 ? "bg-success" : pct >= 40 ? "bg-warning" : "bg-destructive",
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* Marcador + detalle por estudiante */}
      <Card>
        <CardContent className="space-y-1.5 p-4">
          <p className="mb-1 flex items-center gap-1.5 text-sm font-bold text-muted-foreground">
            <Medal className="size-4" /> Por estudiante
          </p>
          {partsLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : !participants || participants.length === 0 ? (
            <p className="py-3 text-center text-xs text-muted-foreground">Nadie se unió.</p>
          ) : (
            participants.map((p, i) => (
              <div key={p.id} className="rounded-lg">
                <button
                  type="button"
                  onClick={() => setOpenParticipant((v) => (v === p.id ? null : p.id))}
                  className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-muted/50"
                >
                  <span
                    className={cn(
                      "w-5 shrink-0 text-center text-xs font-bold",
                      i < 3 ? MEDAL_COLOR[i] : "text-muted-foreground",
                    )}
                  >
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                    {p.full_name ?? "Estudiante"}
                  </span>
                  <span className="shrink-0 text-sm font-bold text-primary">{p.score}</span>
                  <ChevronDown
                    className={cn(
                      "size-4 shrink-0 text-muted-foreground transition-transform",
                      openParticipant === p.id && "rotate-180",
                    )}
                  />
                </button>
                {openParticipant === p.id && <ParticipantDetail participantId={p.id} />}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ParticipantDetail({ participantId }: { participantId: string }) {
  const { data: answers, isLoading } = useQuizParticipantDetail(participantId, true);

  if (isLoading) {
    return (
      <div className="flex justify-center py-3">
        <Spinner className="size-5" />
      </div>
    );
  }

  return (
    <div className="ml-8 mt-1 space-y-2 border-l-2 border-muted pl-3">
      {(answers ?? []).length === 0 ? (
        <p className="py-2 text-xs text-muted-foreground">Todavía no respondió nada.</p>
      ) : (
        (answers ?? []).map((a) => (
          <div key={a.exercise_id} className="py-1 text-xs">
            <p className="font-semibold">{a.title}</p>
            <div className="mt-0.5 flex items-start gap-1.5">
              {a.is_correct ? (
                <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-success" />
              ) : (
                <XCircle className="mt-0.5 size-3.5 shrink-0 text-destructive" />
              )}
              <div>
                <p className={a.is_correct ? "text-success" : "text-destructive"}>
                  {a.options[a.selected] ?? "—"}
                </p>
                {!a.is_correct && (
                  <p className="text-muted-foreground">Correcta: {a.options[a.correct_index] ?? "—"}</p>
                )}
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
