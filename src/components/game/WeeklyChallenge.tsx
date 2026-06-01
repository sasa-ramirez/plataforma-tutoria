import { motion } from "framer-motion";
import { Target, Check } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { WEEKLY_GOAL } from "@/lib/achievements";

export function WeeklyChallenge({ weekCount }: { weekCount: number }) {
  const done = Math.min(weekCount, WEEKLY_GOAL);
  const pct = Math.round((done / WEEKLY_GOAL) * 100);
  const complete = done >= WEEKLY_GOAL;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="p-5">
        <div className="mb-3 flex items-center gap-2">
          <div className="grid size-9 place-items-center rounded-xl bg-accent/15 text-accent">
            {complete ? <Check className="size-5" /> : <Target className="size-5" />}
          </div>
          <div>
            <p className="font-bold">Reto semanal</p>
            <p className="text-xs text-muted-foreground">
              {complete
                ? "¡Completado! 🎉 Vuelve la próxima semana"
                : `Resuelve ${WEEKLY_GOAL} ejercicios esta semana`}
            </p>
          </div>
          <span className="ml-auto text-sm font-bold tabular-nums text-muted-foreground">
            {done}/{WEEKLY_GOAL}
          </span>
        </div>
        <Progress value={pct} />
      </Card>
    </motion.div>
  );
}
