import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown,
  Eye,
  ClipboardPaste,
  ShieldAlert,
  Clock,
  Code2,
  BookOpen,
  Timer,
  UserCheck,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/common/Spinner";
import { useToast } from "@/components/ui/toast";
import { AIFeedbackPanel } from "@/components/ai/AIFeedbackPanel";
import {
  fetchSubmissionsForExercise,
  fetchExamLogs,
  setTeacherGrade,
} from "@/services/teacher";
import type { SubmissionRow } from "@/services/teacher";
import { initials, cn } from "@/lib/utils";

// Muestra la respuesta no-código de forma legible.
function formatAnswer(answer: Record<string, unknown>): string {
  if (answer.selected != null) {
    const i = Number(answer.selected);
    return Number.isFinite(i)
      ? `Opción ${String.fromCharCode(65 + i)}`
      : String(answer.selected);
  }
  if (answer.value != null) return `Valor: ${answer.value}`;
  return JSON.stringify(answer);
}

/** "1h 12m", "8m", "menos de 1m" — duración entre entrar y entregar. */
function formatDuration(startedAt: string | null, submittedAt: string | null): string | null {
  if (!startedAt || !submittedAt) return null;
  const diff = new Date(submittedAt).getTime() - new Date(startedAt).getTime();
  if (diff <= 0) return null;
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return "menos de 1m";
}

const EVENT_LABEL: Record<string, string> = {
  window_hidden: "Salió de pantalla",
  window_visible: "Volvió a la pantalla",
  tab_blur: "Perdió el foco",
  tab_focus: "Recuperó el foco",
  paste: "Pegó código",
  copy: "Copió código",
  fullscreen_exit: "Salió de pantalla completa",
};

function ExamTimeline({ submissionId }: { submissionId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["exam-logs", submissionId],
    queryFn: () => fetchExamLogs(submissionId),
  });

  if (isLoading) return <Skeleton className="h-16 w-full" />;
  if (!data || data.length === 0)
    return (
      <p className="px-2 py-3 text-xs text-muted-foreground">
        Sin eventos registrados.
      </p>
    );

  return (
    <ol className="space-y-1.5 border-l border-border pl-3">
      {data.map((log) => (
        <li key={log.id} className="text-xs">
          <span className="font-mono text-muted-foreground">
            {new Date(log.created_at).toLocaleTimeString()}
          </span>{" "}
          <span
            className={cn(
              "font-medium",
              log.event_type === "window_hidden" || log.event_type === "paste"
                ? "text-destructive"
                : "text-foreground",
            )}
          >
            {EVENT_LABEL[log.event_type] ?? log.event_type}
          </span>
          {typeof (log.meta as { chars?: number })?.chars === "number" && (
            <span className="text-muted-foreground">
              {" "}
              ({(log.meta as { chars: number }).chars} caracteres)
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}

/** El tutor corrige la nota de la IA (o califica si la IA no pudo) y comenta. */
function GradeEditor({ s, exerciseId }: { s: SubmissionRow; exerciseId: string }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [score, setScore] = useState(String(s.score ?? s.feedback?.score ?? ""));
  const [comment, setComment] = useState(s.teacher_comment ?? "");
  const manual = !!s.teacher_graded_at;

  const n = Number(score);
  const valid = score.trim() !== "" && Number.isInteger(n) && n >= 0 && n <= 100;

  const save = useMutation({
    mutationFn: () => setTeacherGrade(s.id, n, comment),
    onSuccess: () => {
      toast("Nota guardada. Se le avisó al estudiante.", "success");
      qc.invalidateQueries({ queryKey: ["submissions", exerciseId] });
    },
    onError: (e) =>
      toast((e as { message?: string }).message ?? "No se pudo guardar la nota", "error"),
  });

  return (
    <div className="space-y-2 rounded-xl border border-primary/30 bg-primary/5 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="flex items-center gap-1.5 text-xs font-bold text-primary">
          <UserCheck className="size-3.5" /> Tu calificación
        </p>
        {manual && (
          <span className="text-[11px] text-muted-foreground">
            · ya calificada por ti
            {s.feedback ? ` (la IA había puesto ${s.feedback.score})` : ""}
          </span>
        )}
        {!manual && s.feedback && (
          <span className="text-[11px] text-muted-foreground">
            · la IA sugirió {s.feedback.score}; puedes ajustarla
          </span>
        )}
      </div>
      <div className="flex items-start gap-2">
        <div className="w-24 shrink-0">
          <Input
            type="number"
            inputMode="numeric"
            min={0}
            max={100}
            value={score}
            onChange={(e) => setScore(e.target.value)}
            placeholder="0–100"
            aria-label="Nota de 0 a 100"
            className="h-9 text-center font-bold"
          />
        </div>
        <Textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Comentario para el estudiante (opcional)"
          aria-label="Comentario para el estudiante"
          className="min-h-[36px] flex-1 text-sm"
          rows={2}
        />
      </div>
      <div className="flex justify-end">
        <Button
          size="sm"
          variant="brand"
          onClick={() => save.mutate()}
          disabled={!valid || save.isPending}
        >
          {save.isPending ? <Spinner className="size-4" /> : null}
          {manual ? "Actualizar nota" : "Guardar nota"}
        </Button>
      </div>
    </div>
  );
}

/** Un intento individual dentro de la tarjeta del estudiante. */
function AttemptRow({
  s,
  exerciseId,
  open,
  onToggle,
}: {
  s: SubmissionRow;
  exerciseId: string;
  open: boolean;
  onToggle: () => void;
}) {
  const flagged = s.exit_count > 0 || s.paste_count > 0;
  return (
    <div className="rounded-lg border bg-background">
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
      >
        <span className="text-xs font-semibold text-muted-foreground">
          Intento {s.attempt}
        </span>
        {s.submitted_at && (
          <span className="text-xs text-muted-foreground">
            ·{" "}
            {new Date(s.submitted_at).toLocaleString("es-CO", {
              day: "2-digit",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        )}
        <span className="flex-1" />
        {flagged && (
          <Badge variant="destructive">
            <ShieldAlert className="mr-1 size-3" /> {s.exit_count + s.paste_count}
          </Badge>
        )}
        {s.teacher_graded_at && (
          <span title="Nota puesta por el tutor" className="text-primary">
            <UserCheck className="size-3.5" />
          </span>
        )}
        {s.status === "graded" && s.score != null ? (
          <Badge variant={s.score >= 60 ? "success" : "warning"}>{s.score}</Badge>
        ) : (
          <Badge variant="secondary">
            <Clock className="mr-1 size-3" /> {s.status}
          </Badge>
        )}
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t"
          >
            <div className="space-y-3 p-3">
              {/* Respuesta entregada */}
              <div>
                <p className="mb-1 flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
                  <Code2 className="size-3.5" /> Respuesta entregada
                </p>
                {s.answer ? (
                  <p className="rounded-lg bg-muted px-3 py-2 text-sm font-semibold">
                    {formatAnswer(s.answer)}
                  </p>
                ) : s.code.trim() ? (
                  <pre className="max-h-72 overflow-auto rounded-lg bg-[#0e0d1a] p-3 font-mono text-xs leading-relaxed text-white/90">
                    {s.code}
                  </pre>
                ) : (
                  <p className="text-xs text-muted-foreground">(entrega vacía)</p>
                )}
              </div>

              {/* Feedback de la IA */}
              {s.feedback && <AIFeedbackPanel feedback={s.feedback} />}

              {/* Nota manual del tutor */}
              <GradeEditor s={s} exerciseId={exerciseId} />

              {/* Cuándo entró, cuándo entregó, cuánto se demoró */}
              {(s.started_at || s.submitted_at) && (
                <div className="flex flex-wrap gap-x-4 gap-y-1 rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                  {s.started_at && (
                    <span>
                      <span className="font-semibold">Entró:</span>{" "}
                      {new Date(s.started_at).toLocaleString("es-CO", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  )}
                  {s.submitted_at && (
                    <span>
                      <span className="font-semibold">Entregó:</span>{" "}
                      {new Date(s.submitted_at).toLocaleString("es-CO", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  )}
                  {formatDuration(s.started_at, s.submitted_at) && (
                    <span className="flex items-center gap-1">
                      <Timer className="size-3.5" />
                      <span className="font-semibold">Se demoró:</span>{" "}
                      {formatDuration(s.started_at, s.submitted_at)}
                    </span>
                  )}
                </div>
              )}

              {/* Anti-trampa */}
              <div className="flex gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Eye className="size-3.5" /> {s.exit_count} salidas
                </span>
                <span className="flex items-center gap-1">
                  <ClipboardPaste className="size-3.5" /> {s.paste_count} pegados
                </span>
              </div>
              <ExamTimeline submissionId={s.id} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function SubmissionsPanel({
  exerciseId,
  prompt,
}: {
  exerciseId: string;
  prompt?: string;
}) {
  const [expandedStudent, setExpandedStudent] = useState<string | null>(null);
  const [expandedAttempt, setExpandedAttempt] = useState<string | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["submissions", exerciseId],
    queryFn: () => fetchSubmissionsForExercise(exerciseId),
  });

  const enunciado = prompt && (
    <div className="mb-2 rounded-xl bg-muted/50 p-3">
      <p className="mb-1 flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
        <BookOpen className="size-3.5" /> Enunciado
      </p>
      <p className="whitespace-pre-wrap text-sm">{prompt}</p>
    </div>
  );

  if (isLoading)
    return (
      <div className="space-y-2 p-2">
        {enunciado}
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );

  if (!data || data.length === 0)
    return (
      <div className="space-y-2">
        {enunciado}
        <p className="px-2 py-3 text-xs text-muted-foreground">
          Aún no hay entregas para este ejercicio.
        </p>
      </div>
    );

  // Agrupa las entregas por estudiante: un intento con modo examen ya se
  // limita a 1, pero tareas normales pueden tener varios — se muestran
  // anidados dentro de la tarjeta del estudiante en vez de repetirla.
  const byStudent = new Map<string, SubmissionRow[]>();
  for (const s of data) {
    const list = byStudent.get(s.student_id) ?? [];
    list.push(s);
    byStudent.set(s.student_id, list);
  }
  const groups = Array.from(byStudent.entries()).map(([studentId, rows]) => {
    const attempts = [...rows].sort((a, b) => a.attempt - b.attempt);
    const latest = [...rows].sort(
      (a, b) => new Date(b.submitted_at ?? 0).getTime() - new Date(a.submitted_at ?? 0).getTime(),
    )[0];
    const flagged = rows.some((r) => r.exit_count > 0 || r.paste_count > 0);
    return { studentId, name: rows[0].student_name, attempts, latest, flagged };
  });

  return (
    <div className="space-y-2">
      {enunciado}

      <div className="space-y-1">
        {groups.map((g) => {
          const isOpen = expandedStudent === g.studentId;
          return (
            <div key={g.studentId} className="rounded-xl border">
              <button
                onClick={() =>
                  setExpandedStudent(isOpen ? null : g.studentId)
                }
                className="flex w-full items-center gap-3 px-3 py-2.5 text-left"
              >
                <Avatar className="size-8">
                  <AvatarFallback className="text-[10px]">
                    {initials(g.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    {g.name ?? "Estudiante"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {g.attempts.length} intento{g.attempts.length > 1 ? "s" : ""}
                  </p>
                </div>
                {g.flagged && (
                  <Badge variant="destructive">
                    <ShieldAlert className="size-3" />
                  </Badge>
                )}
                {g.latest.status === "graded" && g.latest.score != null ? (
                  <Badge variant={g.latest.score >= 60 ? "success" : "warning"}>
                    {g.latest.score}
                  </Badge>
                ) : (
                  <Badge variant="secondary">
                    <Clock className="mr-1 size-3" /> {g.latest.status}
                  </Badge>
                )}
                <ChevronDown
                  className={cn(
                    "size-4 text-muted-foreground transition-transform",
                    isOpen && "rotate-180",
                  )}
                />
              </button>

              <AnimatePresence>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden border-t"
                  >
                    <div className="space-y-2 p-2">
                      {g.attempts.map((s) => (
                        <AttemptRow
                          key={s.id}
                          s={s}
                          exerciseId={exerciseId}
                          open={expandedAttempt === s.id}
                          onToggle={() =>
                            setExpandedAttempt(
                              expandedAttempt === s.id ? null : s.id,
                            )
                          }
                        />
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}
