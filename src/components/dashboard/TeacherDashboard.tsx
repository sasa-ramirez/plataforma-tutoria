import { motion } from "framer-motion";
import {
  Users,
  BookOpen,
  FileCheck2,
  Activity,
  CornerDownRight,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { StatCard } from "@/components/common/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { initials } from "@/lib/utils";

// NOTA: datos de ejemplo. Se reemplazan por hooks reales en la Fase 8.
const recentActivity = [
  { name: "Ana Pérez", action: "entregó", target: "Arrays en Java", score: 92 },
  { name: "Luis Gómez", action: "entregó", target: "Condicionales", score: 78 },
  { name: "María Ruiz", action: "salió de pantalla", target: "Examen #2", flag: true },
];

export function TeacherDashboard() {
  const { profile } = useAuth();
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
        <StatCard icon={Users} label="Estudiantes" value={48} delay={0.05} />
        <StatCard
          icon={BookOpen}
          label="Cursos"
          value={3}
          accent="accent"
          delay={0.1}
        />
        <StatCard
          icon={FileCheck2}
          label="Por calificar"
          value={7}
          accent="warning"
          delay={0.15}
        />
        <StatCard
          icon={Activity}
          label="Activos hoy"
          value={21}
          accent="success"
          delay={0.2}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Actividad reciente</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {recentActivity.map((a, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 + i * 0.05 }}
              className="flex items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-muted/50"
            >
              <Avatar className="size-9">
                <AvatarFallback>{initials(a.name)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1 text-sm">
                <span className="font-semibold">{a.name}</span>{" "}
                <span className="text-muted-foreground">{a.action}</span>{" "}
                <span className="inline-flex items-center gap-1">
                  <CornerDownRight className="size-3 text-muted-foreground" />
                  {a.target}
                </span>
              </div>
              {a.flag ? (
                <Badge variant="destructive">⚠ Alerta</Badge>
              ) : (
                <Badge variant="success">{a.score}</Badge>
              )}
            </motion.div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
