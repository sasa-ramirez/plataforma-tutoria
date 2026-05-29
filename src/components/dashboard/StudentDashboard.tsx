import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Flame, Trophy, CheckCircle2, Clock, ArrowRight } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { StatCard } from "@/components/common/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/common/EmptyState";

// NOTA: datos de ejemplo. Se reemplazan por hooks reales en la Fase 3 (tareas).
const pendingTasks = [
  {
    id: "1",
    title: "Operadores y condicionales",
    course: "Lógica de Programación",
    due: "2d 4h",
    difficulty: "Fácil",
  },
  {
    id: "2",
    title: "Arrays en Java",
    course: "Java Básico",
    due: "5h 12m",
    difficulty: "Medio",
  },
];

export function StudentDashboard() {
  const { profile } = useAuth();
  const firstName = profile?.full_name?.split(" ")[0] ?? "👋";

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <p className="text-sm text-muted-foreground">¡Hola de nuevo!</p>
        <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">
          {firstName} <span className="text-gradient">listo para programar</span>
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
          value={12}
          accent="success"
          delay={0.15}
        />
        <StatCard
          icon={Clock}
          label="Pendientes"
          value={pendingTasks.length}
          accent="accent"
          delay={0.2}
        />
      </div>

      {/* Progreso de curso */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tu progreso semanal</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { name: "Lógica de Programación", value: 72 },
            { name: "Java Básico", value: 40 },
          ].map((c) => (
            <div key={c.name} className="space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="font-medium">{c.name}</span>
                <span className="text-muted-foreground">{c.value}%</span>
              </div>
              <Progress value={c.value} />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Tareas pendientes */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-bold">Tareas pendientes</h2>
          <Link
            to="/app/courses"
            className="flex items-center gap-1 text-sm font-semibold text-primary"
          >
            Ver todo <ArrowRight className="size-3.5" />
          </Link>
        </div>

        {pendingTasks.length === 0 ? (
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
        ) : (
          <div className="space-y-3">
            {pendingTasks.map((t, i) => (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 + i * 0.05 }}
              >
                <Card className="flex items-center justify-between gap-3 p-4 transition-transform active:scale-[0.99]">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-semibold">{t.title}</p>
                      <Badge variant="secondary">{t.difficulty}</Badge>
                    </div>
                    <p className="truncate text-sm text-muted-foreground">
                      {t.course}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <Badge variant="warning">
                      <Clock className="mr-1 size-3" /> {t.due}
                    </Badge>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
