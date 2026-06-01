import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Play } from "lucide-react";
import { useContinueLearning } from "@/hooks/useGamification";
import { Skeleton } from "@/components/ui/skeleton";
import { LANGUAGE_META } from "@/lib/constants";
import type { ProgLanguage } from "@/types/database";

export function ContinueLearning() {
  const { data, isLoading } = useContinueLearning();

  if (isLoading) return <Skeleton className="h-24 w-full rounded-2xl" />;
  if (!data) return null;

  const lang = LANGUAGE_META[data.language as ProgLanguage] ?? LANGUAGE_META.pseint;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <Link to={`/app/solve/${data.exercise_id}`}>
        <div className="card-interactive relative overflow-hidden rounded-2xl border p-5 surface-glow">
          <div className="absolute inset-0 gradient-brand opacity-[0.10]" />
          <div className="relative flex items-center gap-4">
            <div className="grid size-14 shrink-0 place-items-center rounded-2xl bg-background/60 text-3xl backdrop-blur">
              {lang.emoji}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold uppercase tracking-widest text-primary">
                Continúa donde quedaste
              </p>
              <h3 className="truncate text-lg font-extrabold">{data.title}</h3>
              <p className="text-sm text-muted-foreground">{lang.label}</p>
            </div>
            <div className="grid size-12 shrink-0 place-items-center rounded-full gradient-brand text-white shadow-lg shadow-primary/40">
              <Play className="size-5 fill-current" />
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
