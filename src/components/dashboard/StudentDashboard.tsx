import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Flame, Trophy, CheckCircle2, Clock, ArrowRight, BookOpen } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useStudentStats } from "@/hooks/useDashboard";
import { StatCard } from "@/components/common/StatCard";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/common/EmptyState";
import { DIFFICULTY_META } from "@/lib/constants";
import { timeLeft } from "@/lib/utils";

export function StudentDashboard() {
  const { profile } = useAuth();
  const { data, isLoading } = useStudentStats();
  const firstName = profile?.full_name?.split(" ")[0] ?? "👋";

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <p className="text-sm text-muted-foreground">¡Hola de nuevo!</p>
        <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">
          {firstName}{" "}
          <span className="text-gradient">listo para programar</span>
        </h1>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          icon={Flame}
          label="Racha"
          value={`${profile?.streak ?? 0} días`}
          accent="warning"
          delay={0.05}
        />
        <StatCard
          icon={Trophy}
          label="XP total"
          value={profile?.xp ?? 0}
          accent="primary"
          delay={0.1}
        />
        <StatCard
          icon={CheckCircle2}
          label="Completados"
          value={isLoading ? "…" : (data?.graded ?? 0)}
          accent="success"
          delay={0.15}
        />
        <StatCard
          icon={Clock}
          label="Pendientes"
          value={isLoading ? "…" : (data?.pending ?? 0)}
          accent="accent"
          delay={0.2}
        />
      </div>

      {/* Mis cursos */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-bold">Mis cursos</h2>
          <Link
            to="/app/courses"
            className="flex items-center gap-1 text-sm font-semibold text-primary"
          >
            Ver todo <ArrowRight className="size-3.5" />
          </Link>
        </div>
        {isLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : data && data.courses.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {data.courses.slice(0, 4).map((c) => (
              <Link key={c.id} to={`/app/courses/${c.id}`}>
                <Card className="flex items-center gap-3 p-4 transition-transform active:scale-[0.99]">
                  <div className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
                    <BookOpen className="size-5" />
                  </div>
                  <span className="truncate font-semibold">{c.title}</span>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={BookOpen}
            title="No estás en ningún curso"
            description="Únete con el código que te dé tu profesor."
            action={
              <Button asChild variant="brand">
                <Link to="/app/courses">Unirme a un curso</Link>
              </Button>
            }
          />
        )}
      </div>

      {/* Tareas pendientes */}
      <div>
        <h2 className="mb-3 font-bold">Tareas pendientes</h2>
        {isLoading ? (
          <Skeleton className="h-20 w-full" />
        ) : data && data.pendingTasks.length > 0 ? (
          <div className="space-y-3">
            {data.pendingTasks.map((t, i) => {
              const diff = DIFFICULTY_META[t.difficulty];
              const remaining = timeLeft(t.closes_at);
              return (
                <motion.div
                  key={t.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 + i * 0.05 }}
                >
                  <Link to={`/app/assignments/${t.id}`}>
                    <Card className="flex items-center justify-between gap-3 p-4 transition-transform active:scale-[0.99]">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate font-semibold">{t.title}</p>
                          <Badge className={diff.className}>{diff.label}</Badge>
                        </div>
                        <p className="truncate text-sm text-muted-foreground">
                          {data.courseTitles[t.course_id] ?? "Curso"}
                        </p>
                      </div>
                      {remaining && (
                        <Badge variant="warning" className="shrink-0">
                          <Clock className="mr-1 size-3" /> {remaining}
                        </Badge>
                      )}
                    </Card>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        ) : (
          <EmptyState
            icon={CheckCircle2}
            title="¡Todo al día!"
            description="No tienes tareas pendientes. Aprovecha para practicar."
            action={
              <Button asChild variant="brand">
                <Link to="/app/practice">Ir a practicar</Link>
              </Button>
            }
          />
        )}
      </div>
    </div>
  );
}
