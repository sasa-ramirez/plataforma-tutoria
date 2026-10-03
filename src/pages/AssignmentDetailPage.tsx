import { useMemo, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ShieldAlert,
  ChevronDown,
  Clock,
  Trophy,
  Code2,
  Lock,
  ChevronRight,
  Sparkles,
  Users,
  Trash2,
  Radio,
  FileText,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import {
  useAssignment,
  useExercises,
  useDeleteAssignment,
} from "@/hooks/useAssignments";
import { useCourseProgramInfo } from "@/hooks/useCourses";
import { useToast } from "@/components/ui/toast";
import { CreateExerciseDialog } from "@/components/assignments/CreateExerciseDialog";
import { StartQuizDialog } from "@/components/assignments/StartQuizDialog";
import { GenerateQuizDialog } from "@/components/assignments/GenerateQuizDialog";
import { QuizHistoryList } from "@/components/assignments/QuizHistoryList";
import { useOpenQuiz } from "@/hooks/useQuiz";
import { SubmissionsPanel } from "@/components/assignments/SubmissionsPanel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/common/EmptyState";
import { FullScreenLoader } from "@/components/common/Spinner";
import { assignmentBadge, DIFFICULTY_META } from "@/lib/constants";
import { isAssignmentOpen, timeLeft, cn } from "@/lib/utils";
import type { Exercise } from "@/types/database";

type ExerciseGroup =
  | { kind: "single"; exercise: Exercise }
  | { kind: "batch"; batchId: string; topic: string | null; exercises: Exercise[] };

/** Agrupa preguntas CONSECUTIVAS del mismo lote de IA (mismo quiz_batch_id)
 * bajo un solo grupo plegable — se guardan igual que siempre, esto es solo
 * para que la lista no se vea como N filas sueltas. */
function groupExercises(exercises: Exercise[]): ExerciseGroup[] {
  const groups: ExerciseGroup[] = [];
  for (const ex of exercises) {
    const last = groups[groups.length - 1];
    if (ex.quiz_batch_id && last?.kind === "batch" && last.batchId === ex.quiz_batch_id) {
      last.exercises.push(ex);
    } else if (ex.quiz_batch_id) {
      groups.push({
        kind: "batch",
        batchId: ex.quiz_batch_id,
        topic: ex.quiz_batch_topic,
        exercises: [ex],
      });
    } else {
      groups.push({ kind: "single", exercise: ex });
    }
  }
  return groups;
}

/** Botón de un estudiante hacia el quiz en vivo (o aviso de que aún no hay). */
function QuizEntryButton({ openQuizId }: { openQuizId: string | null }) {
  return openQuizId ? (
    <Button asChild variant="brand" size="sm">
      <Link to={`/app/quiz/${openQuizId}`}>
        <Radio className="size-4" /> Entrar al quiz
      </Link>
    </Button>
  ) : (
    <Button variant="outline" size="sm" disabled>
      Quiz aún no iniciado
    </Button>
  );
}

function ExerciseRow({
  ex,
  number,
  isTeacher,
  locked,
  openQuizId,
  openEntregas,
  setOpenEntregas,
}: {
  ex: Exercise;
  number: number;
  isTeacher: boolean;
  locked: boolean;
  openQuizId: string | null;
  openEntregas: string | null;
  setOpenEntregas: (id: string | null) => void;
}) {
  // Las preguntas de opción múltiple son del quiz en vivo: el estudiante no
  // las resuelve ni las lee por separado (se las vería de antemano).
  const quizOnly = !isTeacher && ex.type === "multiple_choice";
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-sm font-bold text-primary">
          {number}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{quizOnly ? `Pregunta ${number} del quiz` : ex.title}</p>
          <p className="line-clamp-1 text-sm text-muted-foreground">
            {quizOnly ? "Se responde en el quiz en vivo" : ex.prompt}
          </p>
        </div>
        {isTeacher ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setOpenEntregas(openEntregas === ex.id ? null : ex.id)}
          >
            <Users className="size-4" /> Entregas
          </Button>
        ) : quizOnly ? (
          <QuizEntryButton openQuizId={openQuizId} />
        ) : (
          !locked && (
            <Button asChild variant="brand" size="sm">
              <Link to={`/app/solve/${ex.id}`}>
                Resolver
                <ChevronRight className="size-4" />
              </Link>
            </Button>
          )
        )}
      </div>

      {isTeacher && (
        <AnimatePresence>
          {openEntregas === ex.id && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-3 border-t pt-3">
                <SubmissionsPanel exerciseId={ex.id} prompt={ex.prompt} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </Card>
  );
}

export function AssignmentDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isTeacher } = useAuth();
  const { data: a, isLoading } = useAssignment(id);
  const { data: exercises, isLoading: exLoading } = useExercises(id);
  const { mutateAsync: deleteAssignment, isPending: deleting } =
    useDeleteAssignment(a?.course_id ?? "");
  const { data: programInfo } = useCourseProgramInfo(a?.course_id ?? "");
  // La única sesión de quiz abierta de esta tarea (todos entran a la misma).
  const { data: openQuiz } = useOpenQuiz(id);
  const openQuizId = openQuiz?.id ?? null;
  const [openEntregas, setOpenEntregas] = useState<string | null>(null);
  const [openBatches, setOpenBatches] = useState<Set<string>>(new Set());
  const toggleBatch = (batchId: string) =>
    setOpenBatches((prev) => {
      const next = new Set(prev);
      if (next.has(batchId)) next.delete(batchId);
      else next.add(batchId);
      return next;
    });
  const groups = useMemo(() => groupExercises(exercises ?? []), [exercises]);

  const handleDelete = async () => {
    if (!a) return;
    if (
      !window.confirm(
        `¿Eliminar la tarea "${a.title}"? Se ocultará para ti y tus estudiantes. Esta acción no se puede deshacer fácilmente.`,
      )
    )
      return;
    try {
      await deleteAssignment(a.id);
      toast("Tarea eliminada", "success");
      navigate(`/app/courses/${a.course_id}`);
    } catch (err) {
      toast(err instanceof Error ? err.message : "No se pudo eliminar", "error");
    }
  };

  if (isLoading) return <FullScreenLoader />;
  if (!a)
    return (
      <EmptyState
        icon={Code2}
        title="Tarea no encontrada"
        description="Puede que se haya cerrado o no tengas acceso."
        action={
          <Button asChild variant="brand">
            <Link to="/app/courses">Volver</Link>
          </Button>
        }
      />
    );

  const lang = assignmentBadge(a.language, programInfo?.subjectName, programInfo?.facultyName);
  const hasMultipleChoice = !!exercises?.some((ex) => ex.type === "multiple_choice");
  const diff = DIFFICULTY_META[a.difficulty];
  const open = isAssignmentOpen(a);
  const locked = !open && !isTeacher;
  const remaining = timeLeft(a.closes_at);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <Link
          to={`/app/courses/${a.course_id}`}
          className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Volver al curso
        </Link>
        {isTeacher && (
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={handleDelete}
            disabled={deleting}
          >
            <Trash2 className="size-4" /> Eliminar
          </Button>
        )}
      </div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
            <lang.icon className="size-5" />
          </span>
          <h1 className="text-2xl font-extrabold tracking-tight">{a.title}</h1>
          {a.is_exam && (
            <Badge variant="destructive">
              <ShieldAlert className="mr-1 size-3" /> Examen
            </Badge>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge className={diff.className}>{diff.label}</Badge>
          <Badge variant="outline">
            <Trophy className="mr-1 size-3" /> {a.points} pts
          </Badge>
          {locked ? (
            <Badge variant="secondary">
              <Lock className="mr-1 size-3" /> Cerrada
            </Badge>
          ) : remaining ? (
            <Badge variant="warning">
              <Clock className="mr-1 size-3" /> {remaining}
            </Badge>
          ) : null}
          {a.time_limit_min && (
            <Badge variant="outline">⏱ {a.time_limit_min} min</Badge>
          )}
        </div>
      </motion.div>

      {a.description && (
        <p className="text-sm text-muted-foreground">{a.description}</p>
      )}
      {a.instructions && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Instrucciones</CardTitle>
          </CardHeader>
          <CardContent className="whitespace-pre-wrap text-sm text-muted-foreground">
            {a.instructions}
          </CardContent>
        </Card>
      )}

      {locked && (
        <Card className="border-warning/30 bg-warning/5">
          <CardContent className="flex items-center gap-3 p-4 text-sm">
            <Lock className="size-5 text-warning" />
            Esta tarea está cerrada. Ya no puedes enviar respuestas.
          </CardContent>
        </Card>
      )}

      {/* Aviso al estudiante: hay un quiz abierto en esta tarea */}
      {!isTeacher && openQuizId && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex flex-wrap items-center gap-3 p-4">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
              <Radio className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">
                {openQuiz?.status === "lobby" ? "Quiz en vivo: sala abierta" : "Quiz en vivo en curso"}
              </p>
              <p className="text-sm text-muted-foreground">
                Entra con este botón, no hace falta ningún código.
              </p>
            </div>
            <Button asChild variant="brand" size="sm">
              <Link to={`/app/quiz/${openQuizId}`}>Entrar al quiz</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Ejercicios */}
      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-bold">Ejercicios</h2>
          <div className="flex flex-wrap items-center gap-2">
            {isTeacher && hasMultipleChoice && (
              <Button asChild size="sm" variant="ghost">
                <Link to={`/app/assignments/${a.id}/quiz-report`}>
                  <FileText className="size-4" /> Informe
                </Link>
              </Button>
            )}
            {isTeacher && hasMultipleChoice && <QuizHistoryList assignmentId={a.id} />}
            {isTeacher && hasMultipleChoice &&
              (openQuizId ? (
                <Button asChild size="sm" variant="brand">
                  <Link to={`/app/quiz/${openQuizId}`}>
                    <Radio className="size-4" /> Volver al quiz en curso
                  </Link>
                </Button>
              ) : (
                <StartQuizDialog assignmentId={a.id} />
              ))}
            {isTeacher && (
              <GenerateQuizDialog assignment={a} subjectName={programInfo?.subjectName} />
            )}
            {isTeacher && (
              <CreateExerciseDialog
                assignment={a}
                nextIndex={(exercises?.length ?? 0) + 1}
              />
            )}
          </div>
        </div>

        {exLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : exercises && exercises.length > 0 ? (
          <div className="space-y-3">
            {(() => {
              let counter = 0;
              return groups.map((g, gi) => {
                if (g.kind === "single") {
                  counter++;
                  return (
                    <motion.div
                      key={g.exercise.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: gi * 0.05 }}
                    >
                      <ExerciseRow
                        ex={g.exercise}
                        number={counter}
                        isTeacher={isTeacher}
                        locked={locked}
                        openQuizId={openQuizId}
                        openEntregas={openEntregas}
                        setOpenEntregas={setOpenEntregas}
                      />
                    </motion.div>
                  );
                }

                const startNumber = counter + 1;
                counter += g.exercises.length;
                const expanded = openBatches.has(g.batchId);

                // Estudiante: el lote es "el quiz", sin lista de preguntas
                // (verlas de antemano arruinaría el quiz).
                if (!isTeacher) {
                  return (
                    <motion.div
                      key={g.batchId}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: gi * 0.05 }}
                    >
                      <Card className="flex items-center gap-3 p-4">
                        <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                          <Sparkles className="size-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold">
                            Quiz{g.topic ? `: ${g.topic}` : ""}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {g.exercises.length} pregunta{g.exercises.length === 1 ? "" : "s"} · se
                            responde en el quiz en vivo
                          </p>
                        </div>
                        <QuizEntryButton openQuizId={openQuizId} />
                      </Card>
                    </motion.div>
                  );
                }
                return (
                  <motion.div
                    key={g.batchId}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: gi * 0.05 }}
                  >
                    <Card className="p-4">
                      <button
                        type="button"
                        onClick={() => toggleBatch(g.batchId)}
                        className="flex w-full items-center gap-3 text-left"
                      >
                        <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                          <Sparkles className="size-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold">
                            Quiz generado{g.topic ? `: ${g.topic}` : ""}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {g.exercises.length} pregunta{g.exercises.length === 1 ? "" : "s"} de
                            opción múltiple
                          </p>
                        </div>
                        <ChevronDown
                          className={cn(
                            "size-4 shrink-0 text-muted-foreground transition-transform",
                            expanded && "rotate-180",
                          )}
                        />
                      </button>
                      <AnimatePresence>
                        {expanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="mt-3 space-y-3 border-t pt-3">
                              {g.exercises.map((ex, j) => (
                                <ExerciseRow
                                  key={ex.id}
                                  ex={ex}
                                  number={startNumber + j}
                                  isTeacher={isTeacher}
                                  locked={locked}
                                  openQuizId={openQuizId}
                                  openEntregas={openEntregas}
                                  setOpenEntregas={setOpenEntregas}
                                />
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </Card>
                  </motion.div>
                );
              });
            })()}
          </div>
        ) : (
          <EmptyState
            icon={Code2}
            title="Sin ejercicios"
            description={
              isTeacher
                ? "Añade ejercicios para que tus estudiantes resuelvan."
                : "Aún no hay ejercicios en esta tarea."
            }
          />
        )}
      </div>
    </div>
  );
}
