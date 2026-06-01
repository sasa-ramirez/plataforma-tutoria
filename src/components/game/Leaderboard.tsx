import { motion } from "framer-motion";
import { Trophy, Flame } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useLeaderboard } from "@/hooks/useGamification";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/common/EmptyState";
import { cn, initials } from "@/lib/utils";

const MEDAL = ["🥇", "🥈", "🥉"];

export function Leaderboard({ limit = 10 }: { limit?: number }) {
  const { profile } = useAuth();
  const { data, isLoading } = useLeaderboard(limit);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Trophy className="size-4 text-warning" /> Ranking
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))
        ) : data && data.length > 0 ? (
          data.map((u, i) => {
            const isMe = u.id === profile?.id;
            return (
              <motion.div
                key={u.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-2 py-2",
                  isMe
                    ? "bg-primary/10 ring-1 ring-primary/30"
                    : "hover:bg-muted/50",
                )}
              >
                <span className="w-6 text-center text-sm font-bold tabular-nums text-muted-foreground">
                  {i < 3 ? MEDAL[i] : i + 1}
                </span>
                <Avatar className="size-8">
                  <AvatarImage src={u.avatar_url ?? undefined} />
                  <AvatarFallback className="text-[10px]">
                    {initials(u.full_name)}
                  </AvatarFallback>
                </Avatar>
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                  {u.full_name ?? "Estudiante"}
                  {isMe && (
                    <span className="ml-1 text-xs text-primary">(tú)</span>
                  )}
                </span>
                {u.streak > 0 && (
                  <span className="flex items-center gap-0.5 text-xs text-warning">
                    <Flame className="size-3" /> {u.streak}
                  </span>
                )}
                <span className="w-16 text-right text-sm font-extrabold tabular-nums text-primary">
                  {u.xp} XP
                </span>
              </motion.div>
            );
          })
        ) : (
          <EmptyState
            icon={Trophy}
            title="Aún no hay ranking"
            description="Resuelve ejercicios para ganar XP y aparecer aquí."
          />
        )}
      </CardContent>
    </Card>
  );
}
