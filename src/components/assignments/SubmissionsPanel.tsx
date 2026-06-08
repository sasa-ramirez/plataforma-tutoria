import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown,
  Eye,
  ClipboardPaste,
  ShieldAlert,
  Clock,
  Code2,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AIFeedbackPanel } from "@/components/ai/AIFeedbackPanel";
import { fetchSubmissionsForExercise, fetchExamLogs } from "@/services/teacher";
import { initials, cn } from "@/lib/utils";

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
        Sin eventos registrados. 🎉
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

export function SubmissionsPanel({ exerciseId }: { exerciseId: string }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["submissions", exerciseId],
    queryFn: () => fetchSubmissionsForExercise(exerciseId),
  });

  if (isLoading)
    return (
      <div className="space-y-2 p-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );

  if (!data || data.length === 0)
    return (
      <p className="px-2 py-3 text-xs text-muted-foreground">
        Aún no hay entregas para este ejercicio.
      </p>
    );

  return (
    <div className="space-y-1">
      {data.map((s) => {
        const flagged = s.exit_count > 0 || s.paste_count > 0;
        const isOpen = expanded === s.id;
        return (
          <div key={s.id} className="rounded-xl border">
            <button
              onClick={() => setExpanded(isOpen ? null : s.id)}
              className="flex w-full items-center gap-3 px-3 py-2.5 text-left"
            >
              <Avatar className="size-8">
                <AvatarFallback className="text-[10px]">
                  {initials(s.student_name)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">
                  {s.student_name ?? "Estudiante"}
                </p>
                <p className="text-xs text-muted-foreground">
                  Intento {s.attempt}
                  {s.submitted_at &&
                    ` · ${new Date(s.submitted_at).toLocaleDateString()}`}
                </p>
              </div>
              {flagged && (
                <Badge variant="destructive">
                  <ShieldAlert className="mr-1 size-3" /> {s.exit_count + s.paste_count}
                </Badge>
              )}
              {s.status === "graded" && s.score != null ? (
                <Badge variant={s.score >= 60 ? "success" : "warning"}>
                  {s.score}
                </Badge>
              ) : (
                <Badge variant="secondary">
                  <Clock className="mr-1 size-3" /> {s.status}
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
                  <div className="space-y-3 p-3">
                    {/* Código entregado */}
                    <div>
                      <p className="mb-1 flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
                        <Code2 className="size-3.5" /> Código entregado
                      </p>
                      {s.code.trim() ? (
                        <pre className="max-h-72 overflow-auto rounded-lg bg-[#0e0d1a] p-3 font-mono text-xs leading-relaxed text-white/90">
                          {s.code}
                        </pre>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          (entrega vacía)
                        </p>
                      )}
                    </div>

                    {/* Feedback de la IA */}
                    {s.feedback && <AIFeedbackPanel feedback={s.feedback} />}

                    {/* Anti-trampa */}
                    <div className="flex gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Eye className="size-3.5" /> {s.exit_count} salidas
                      </span>
                      <span className="flex items-center gap-1">
                        <ClipboardPaste className="size-3.5" /> {s.paste_count}{" "}
                        pegados
                      </span>
                    </div>
                    <ExamTimeline submissionId={s.id} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
