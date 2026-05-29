import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  accent = "primary",
  delay = 0,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  hint?: string;
  accent?: "primary" | "accent" | "success" | "warning";
  delay?: number;
}) {
  const accentMap = {
    primary: "bg-primary/15 text-primary",
    accent: "bg-accent/15 text-accent",
    success: "bg-success/15 text-success",
    warning: "bg-warning/15 text-warning",
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
    >
      <Card className="p-4">
        <div
          className={cn(
            "mb-3 grid size-10 place-items-center rounded-xl",
            accentMap[accent],
          )}
        >
          <Icon className="size-5" />
        </div>
        <p className="text-2xl font-extrabold tracking-tight">{value}</p>
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        {hint && <p className="mt-1 text-xs text-muted-foreground/70">{hint}</p>}
      </Card>
    </motion.div>
  );
}
