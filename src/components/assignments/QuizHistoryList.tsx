import { useState } from "react";
import { Link } from "react-router-dom";
import { History, Radio, Timer } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuizSessionsByAssignment } from "@/hooks/useQuiz";

const STATUS_LABEL: Record<string, string> = {
  lobby: "En sala de espera",
  active: "En curso",
  ended: "Terminado",
};

/** Lista los quizzes en vivo que se han lanzado sobre esta tarea, con
 * enlace a los resultados de cada uno (para verlos después de que termine,
 * no solo mientras están en vivo). */
export function QuizHistoryList({ assignmentId }: { assignmentId: string }) {
  const [open, setOpen] = useState(false);
  const { data: sessions, isLoading } = useQuizSessionsByAssignment(assignmentId);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost">
          <History className="size-4" /> Quizzes anteriores
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Quizzes de esta tarea</DialogTitle>
          <DialogDescription>
            Entra a cualquiera para ver sus resultados, aunque ya haya terminado.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-96 space-y-2 overflow-y-auto">
          {isLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : !sessions || sessions.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Todavía no has lanzado ningún quiz en vivo aquí.
            </p>
          ) : (
            sessions.map((s) => (
              <Link
                key={s.id}
                to={s.status === "ended" ? `/app/quiz/${s.id}/results` : `/app/quiz/${s.id}`}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 rounded-xl border p-3 text-sm hover:bg-muted/50"
              >
                <Radio className="size-4 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">
                    {s.mode === "sync" ? "Al mismo tiempo" : "A su ritmo"}
                    {s.shuffle && " · orden aleatorio"}
                  </p>
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Timer className="size-3" />
                    {new Date(s.created_at).toLocaleString("es-CO", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                <Badge variant={s.status === "ended" ? "secondary" : "success"}>
                  {STATUS_LABEL[s.status] ?? s.status}
                </Badge>
              </Link>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
