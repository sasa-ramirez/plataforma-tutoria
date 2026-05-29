import { motion } from "framer-motion";
import {
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Info,
  Lightbulb,
  ThumbsUp,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { AIFeedback, AIError } from "@/types/database";

function scoreColor(score: number) {
  if (score >= 80) return "text-success";
  if (score >= 50) return "text-warning";
  return "text-destructive";
}

const SEVERITY: Record<
  AIError["severity"],
  { icon: typeof Info; cls: string }
> = {
  error: { icon: AlertTriangle, cls: "text-destructive" },
  warning: { icon: AlertTriangle, cls: "text-warning" },
  info: { icon: Info, cls: "text-primary" },
};

export function AIFeedbackPanel({ feedback }: { feedback: AIFeedback }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* Score */}
      <Card className="overflow-hidden">
        <div className="flex items-center gap-4 p-5">
          <div className="relative grid size-20 shrink-0 place-items-center">
            <svg className="absolute inset-0 -rotate-90" viewBox="0 0 80 80">
              <circle
                cx="40"
                cy="40"
                r="34"
                fill="none"
                strokeWidth="7"
                className="stroke-muted"
              />
              <motion.circle
                cx="40"
                cy="40"
                r="34"
                fill="none"
                strokeWidth="7"
                strokeLinecap="round"
                className={cn("stroke-current", scoreColor(feedback.score))}
                strokeDasharray={2 * Math.PI * 34}
                initial={{ strokeDashoffset: 2 * Math.PI * 34 }}
                animate={{
                  strokeDashoffset:
                    2 * Math.PI * 34 * (1 - feedback.score / 100),
                }}
                transition={{ duration: 0.9, ease: "easeOut" }}
              />
            </svg>
            <span
              className={cn(
                "text-2xl font-extrabold",
                scoreColor(feedback.score),
              )}
            >
              {feedback.score}
            </span>
          </div>
          <div className="min-w-0">
            <div className="mb-1 flex items-center gap-1.5 text-sm font-bold text-primary">
              <Sparkles className="size-4" /> Feedback de la IA
            </div>
            {feedback.summary && (
              <p className="text-sm text-muted-foreground">
                {feedback.summary}
              </p>
            )}
          </div>
        </div>
      </Card>

      {/* Fortalezas */}
      {feedback.strengths?.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h4 className="mb-2 flex items-center gap-1.5 text-sm font-bold text-success">
              <ThumbsUp className="size-4" /> Lo que hiciste bien
            </h4>
            <ul className="space-y-1.5">
              {feedback.strengths.map((s, i) => (
                <li key={i} className="flex gap-2 text-sm">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
                  {s}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Errores */}
      {feedback.errors?.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h4 className="mb-2 text-sm font-bold">A revisar</h4>
            <ul className="space-y-2">
              {feedback.errors.map((e, i) => {
                const S = SEVERITY[e.severity] ?? SEVERITY.info;
                return (
                  <li key={i} className="flex gap-2 text-sm">
                    <S.icon className={cn("mt-0.5 size-4 shrink-0", S.cls)} />
                    <span>
                      {e.line != null && (
                        <span className="mr-1 font-mono text-xs text-muted-foreground">
                          L{e.line}
                        </span>
                      )}
                      {e.message}
                    </span>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Sugerencias */}
      {feedback.suggestions?.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h4 className="mb-2 flex items-center gap-1.5 text-sm font-bold text-warning">
              <Lightbulb className="size-4" /> Sugerencias
            </h4>
            <ul className="space-y-1.5">
              {feedback.suggestions.map((s, i) => (
                <li key={i} className="flex gap-2 text-sm text-muted-foreground">
                  <span className="text-warning">→</span>
                  {s}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </motion.div>
  );
}
