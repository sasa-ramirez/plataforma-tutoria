import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Dumbbell, ChevronRight, Code2, Sparkles, Wand2 } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchPracticeExercises } from "@/services/practice";
import { LANGUAGE_META, DIFFICULTY_META } from "@/lib/constants";

export function PracticePage() {
  const { data, isLoading } = useQuery({
    queryKey: ["practice-exercises"],
    queryFn: fetchPracticeExercises,
  });

  return (
    <div>
      <PageHeader
        title="Practicar"
        subtitle="Ejercicios libres con feedback de IA. Repite las veces que quieras."
      />

      {/* Práctica libre con IA: genera un ejercicio a tu medida */}
      <Link to="/app/practice/free">
        <Card className="card-interactive mb-3 flex items-center gap-3 bg-gradient-to-br from-accent/15 to-primary/10 p-4 active:scale-[0.99]">
          <div className="grid size-11 place-items-center rounded-xl bg-accent/15 text-accent">
            <Wand2 className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 font-semibold">
              Práctica libre con IA
              <Sparkles className="size-3.5 text-accent" />
            </p>
            <p className="text-xs text-muted-foreground">
              Elige lenguaje, dificultad y tema; la IA crea y califica.
            </p>
          </div>
          <ChevronRight className="size-4 text-muted-foreground" />
        </Card>
      </Link>

      {/* Editor libre: elige lenguaje y empieza desde el código base */}
      <Link to="/app/sandbox">
        <Card className="card-interactive mb-5 flex items-center gap-3 bg-gradient-to-br from-primary/10 to-accent/10 p-4 active:scale-[0.99]">
          <div className="grid size-11 place-items-center rounded-xl bg-primary/15 text-primary">
            <Code2 className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 font-semibold">
              Editor libre
              <Sparkles className="size-3.5 text-accent" />
            </p>
            <p className="text-xs text-muted-foreground">
              Elige lenguaje y empieza con el código base listo.
            </p>
          </div>
          <ChevronRight className="size-4 text-muted-foreground" />
        </Card>
      </Link>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : !data || data.length === 0 ? (
        <EmptyState
          icon={Dumbbell}
          title="Aún no hay ejercicios de práctica"
          description="Ejecuta supabase/seed.sql para cargar ejercicios de ejemplo (Hola Mundo → matrices)."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {data.map((ex, i) => {
            const lang = LANGUAGE_META[ex.language];
            const diff = DIFFICULTY_META[ex.difficulty];
            return (
              <motion.div
                key={ex.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <Link to={`/app/solve/${ex.id}`}>
                  <Card className="card-interactive flex items-center gap-3 p-4 active:scale-[0.99]">
                    <div className="grid size-11 place-items-center rounded-xl bg-muted text-xl">
                      {lang.emoji}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{ex.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {lang.label}
                      </p>
                    </div>
                    <Badge className={diff.className}>{diff.label}</Badge>
                    <ChevronRight className="size-4 text-muted-foreground" />
                  </Card>
                </Link>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
