import { motion } from "framer-motion";
import { Users, BookOpen, FileCheck2, Inbox, Activity } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useTeacherStats } from "@/hooks/useDashboard";
import { StatCard } from "@/components/common/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/common/EmptyState";
import { initials } from "@/lib/utils";

export function TeacherDashboard() {
  const { profile } = useAuth();
  const { data, isLoading } = useTeacherStats();
  const firstName = profile?.full_name?.split(" ")[0] ?? "Profe";

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <p className="text-sm text-muted-foreground">Panel del profesor</p>
        <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">
          Hola, {firstName} 👨‍🏫
        </h1>
      </motion.div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          icon={Users}
          label="Estudiantes"
          value={isLoading ? "…" : (data?.students ?? 0)}
          delay={0.05}
        />
        <StatCard
          icon={BookOpen}
          label="Cursos"
          value={isLoading ? "…" : (data?.courses ?? 0)}
          accent="accent"
          delay={0.1}
        />
        <StatCard
          icon={FileCheck2}
          label="Por calificar"
          value={isLoading ? "…" : (data?.toGrade ?? 0)}
          accent="warning"
          delay={0.15}
        />
        <StatCard
          icon={Activity}
          label="Entregas"
          value={isLoading ? "…" : (data?.submissions ?? 0)}
          accent="success"
          delay={0.2}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Actividad reciente</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))
          ) : data && data.recent.length > 0 ? (
            data.recent.map((a, i) => (
              <motion.div
                key={a.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 + i * 0.05 }}
                className="flex items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-muted/50"
              >
                <Avatar className="size-9">
                  <AvatarFallback>{initials(a.studentName)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1 text-sm">
                  <span className="font-semibold">
                    {a.studentName ?? "Estudiante"}
                  </span>{" "}
                  <span className="text-muted-foreground">
                    entregó “{a.exerciseTitle ?? "ejercicio"}”
                  </span>
                </div>
                {a.status === "graded" && a.score != null ? (
                  <Badge variant={a.score >= 60 ? "success" : "warning"}>
                    {a.score}
                  </Badge>
                ) : (
                  <Badge variant="secondary">por calificar</Badge>
                )}
              </motion.div>
            ))
          ) : (
            <EmptyState
              icon={Inbox}
              title="Sin actividad todavía"
              description="Cuando tus estudiantes entreguen ejercicios, lo verás aquí."
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
