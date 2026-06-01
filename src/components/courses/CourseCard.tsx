import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Users, Copy, MoreVertical } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { COURSE_COLORS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { Course } from "@/types/database";

export function CourseCard({
  course,
  studentCount,
  isTeacher,
  index = 0,
}: {
  course: Course;
  studentCount?: number;
  isTeacher: boolean;
  index?: number;
}) {
  const { toast } = useToast();
  const color = COURSE_COLORS[course.color] ?? COURSE_COLORS.violet;

  const copyCode = (e: React.MouseEvent) => {
    e.preventDefault();
    navigator.clipboard.writeText(course.join_code);
    toast(`Código ${course.join_code} copiado`, "success");
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <Link to={`/app/courses/${course.id}`}>
        <Card className="card-interactive overflow-hidden active:scale-[0.99]">
          <div
            className={cn(
              "flex h-20 items-end bg-gradient-to-br p-4",
              color.gradient,
            )}
          >
            <h3 className="text-lg font-extrabold text-white drop-shadow-sm">
              {course.title}
            </h3>
          </div>
          <div className="flex items-center justify-between gap-2 p-4">
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              {isTeacher ? (
                <>
                  <span className="flex items-center gap-1">
                    <Users className="size-4" />
                    {studentCount ?? 0}
                  </span>
                  <button
                    onClick={copyCode}
                    className="flex items-center gap-1 rounded-lg bg-muted px-2 py-1 font-mono text-xs font-semibold text-foreground transition-colors hover:bg-muted/70"
                  >
                    {course.join_code}
                    <Copy className="size-3" />
                  </button>
                </>
              ) : (
                <span className="line-clamp-1">
                  {course.description || "Sin descripción"}
                </span>
              )}
            </div>
            {isTeacher && (
              <Badge variant="secondary" className="shrink-0">
                <MoreVertical className="size-3" />
              </Badge>
            )}
          </div>
        </Card>
      </Link>
    </motion.div>
  );
}
