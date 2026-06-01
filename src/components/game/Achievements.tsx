import { motion } from "framer-motion";
import { Lock } from "lucide-react";
import { useGameStats } from "@/hooks/useGamification";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { computeAchievements } from "@/lib/achievements";
import { cn } from "@/lib/utils";

export function Achievements() {
  const { data: stats, isLoading } = useGameStats();

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full rounded-2xl" />
        ))}
      </div>
    );
  }
  if (!stats) return null;

  const achievements = computeAchievements(stats);
  const unlocked = achievements.filter((a) => a.unlocked).length;

  return (
    <div>
      <p className="mb-3 text-sm text-muted-foreground">
        Has desbloqueado{" "}
        <span className="font-bold text-foreground">{unlocked}</span> de{" "}
        {achievements.length} logros
      </p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {achievements.map((a, i) => (
          <motion.div
            key={a.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.05 }}
          >
            <Card
              className={cn(
                "relative flex flex-col items-center gap-1 p-4 text-center",
                a.unlocked
                  ? "border-primary/40 surface-glow"
                  : "opacity-70 grayscale",
              )}
            >
              <div className="relative text-3xl">
                {a.emoji}
                {!a.unlocked && (
                  <span className="absolute -bottom-1 -right-2 grid size-5 place-items-center rounded-full bg-muted text-muted-foreground">
                    <Lock className="size-3" />
                  </span>
                )}
              </div>
              <p className="text-sm font-bold leading-tight">{a.title}</p>
              <p className="text-[11px] leading-snug text-muted-foreground">
                {a.description}
              </p>
              {!a.unlocked && (
                <div className="mt-1 w-full">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full gradient-brand"
                      style={{ width: `${a.progress}%` }}
                    />
                  </div>
                  <p className="mt-1 text-[10px] tabular-nums text-muted-foreground">
                    {a.value}/{a.goal}
                  </p>
                </div>
              )}
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
