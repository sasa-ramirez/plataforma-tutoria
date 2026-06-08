import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ShieldAlert,
  Clock,
  Trophy,
  Code2,
  Lock,
  ChevronRight,
  Users,
  Trash2,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import {
  useAssignment,
  useExercises,
  useDeleteAssignment,
} from "@/hooks/useAssignments";
import { useToast } from "@/components/ui/toast";
import { CreateExerciseDialog } from "@/components/assignments/CreateExerciseDialog";
import { SubmissionsPanel } from "@/components/assignments/SubmissionsPanel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/common/EmptyState";
import { FullScreenLoader } from "@/components/common/Spinner";
import { LANGUAGE_META, DIFFICULTY_META } from "@/lib/constants";
import { isAssignmentOpen, timeLeft } from "@/lib/utils";

export function AssignmentDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isTeacher } = useAuth();
  const { data: a, isLoading } = useAssignment(id);
  const { data: exercises, isLoading: exLoading } = useExercises(id);
  const { mutateAsync: deleteAssignment, isPending: deleting } =
    useDeleteAssignment(a?.course_id ?? "");
  const [openEntregas, setOpenEntregas] = useState<string | null>(null);

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
      toast("Tarea eliminada 🗑️", "success");
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

  const lang = LANGUAGE_META[a.language];
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
          <span className="text-2xl">{lang.emoji}</span>
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

      {/* Ejercicios */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-bold">Ejercicios</h2>
          {isTeacher && (
            <CreateExerciseDialog
              assignment={a}
              nextIndex={(exercises?.length ?? 0) + 1}
            />
          )}
        </div>

        {exLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : exercises && exercises.length > 0 ? (
          <div className="space-y-3">
            {exercises.map((ex, i) => (
              <motion.div
                key={ex.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Card className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-sm font-bold text-primary">
                      {i + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{ex.title}</p>
                      <p className="line-clamp-1 text-sm text-muted-foreground">
                        {ex.prompt}
                      </p>
                    </div>
                    {isTeacher ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setOpenEntregas(openEntregas === ex.id ? null : ex.id)
                        }
                      >
                        <Users className="size-4" /> Entregas
                      </Button>
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
                            <SubmissionsPanel exerciseId={ex.id} />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  )}
                </Card>
              </motion.div>
            ))}
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
