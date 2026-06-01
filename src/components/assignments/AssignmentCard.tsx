import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Clock, Lock, ShieldAlert, Trophy } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LANGUAGE_META, DIFFICULTY_META } from "@/lib/constants";
import { cn, isAssignmentOpen, timeLeft } from "@/lib/utils";
import type { Assignment } from "@/types/database";

export function AssignmentCard({
  assignment,
  index = 0,
}: {
  assignment: Assignment;
  index?: number;
}) {
  const lang = LANGUAGE_META[assignment.language];
  const diff = DIFFICULTY_META[assignment.difficulty];
  const open = isAssignmentOpen(assignment);
  const remaining = timeLeft(assignment.closes_at);
  const isDraft = assignment.status === "draft";
  const isClosed = !open && !isDraft;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <Link to={`/app/assignments/${assignment.id}`}>
        <Card
          className={cn(
            "card-interactive p-4 active:scale-[0.99]",
            isClosed && "opacity-70",
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="mb-1 flex flex-wrap items-center gap-1.5">
                <span className="text-lg">{lang.emoji}</span>
                <h3 className="truncate font-bold">{assignment.title}</h3>
                {assignment.is_exam && (
                  <Badge variant="destructive">
                    <ShieldAlert className="mr-1 size-3" /> Examen
                  </Badge>
                )}
              </div>
              {assignment.description && (
                <p className="line-clamp-2 text-sm text-muted-foreground">
                  {assignment.description}
                </p>
              )}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge className={diff.className}>{diff.label}</Badge>
            <Badge variant="outline">
              <Trophy className="mr-1 size-3" /> {assignment.points} pts
            </Badge>
            {isDraft ? (
              <Badge variant="secondary">Borrador</Badge>
            ) : isClosed ? (
              <Badge variant="secondary">
                <Lock className="mr-1 size-3" /> Cerrada
              </Badge>
            ) : remaining ? (
              <Badge variant="warning">
                <Clock className="mr-1 size-3" /> {remaining}
              </Badge>
            ) : (
              <Badge variant="success">Abierta</Badge>
            )}
          </div>
        </Card>
      </Link>
    </motion.div>
  );
}
