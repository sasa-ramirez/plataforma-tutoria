import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import {
  fetchLeaderboard,
  fetchContinueLearning,
  fetchGameStats,
} from "@/services/gamification";

export function useLeaderboard(limit = 10) {
  return useQuery({
    queryKey: ["leaderboard", limit],
    queryFn: () => fetchLeaderboard(limit),
  });
}

export function useContinueLearning() {
  const { profile } = useAuth();
  return useQuery({
    queryKey: ["continue", profile?.id],
    queryFn: () => fetchContinueLearning(profile!.id),
    enabled: !!profile,
  });
}

export function useGameStats() {
  const { profile } = useAuth();
  return useQuery({
    queryKey: ["game-stats", profile?.id, profile?.xp, profile?.streak],
    queryFn: () =>
      fetchGameStats(profile!.id, profile?.xp ?? 0, profile?.streak ?? 0),
    enabled: !!profile,
  });
}
