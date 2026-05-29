import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Dumbbell, ChevronRight } from "lucide-react";
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
                  <Card className="flex items-center gap-3 p-4 transition-transform active:scale-[0.99]">
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
