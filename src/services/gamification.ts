import { supabase } from "@/lib/supabase";
import type { GameStats } from "@/lib/achievements";

export interface LeaderboardRow {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  xp: number;
  streak: number;
}

export async function fetchLeaderboard(
  limit = 20,
): Promise<LeaderboardRow[]> {
  const { data, error } = await supabase.rpc("get_leaderboard", {
    limit_n: limit,
  });
  if (error) throw error;
  return (data ?? []) as LeaderboardRow[];
}

export interface ContinueItem {
  exercise_id: string;
  title: string;
  language: string;
  status: string;
}

/** Último ejercicio en el que trabajó el estudiante. */
export async function fetchContinueLearning(
  studentId: string,
): Promise<ContinueItem | null> {
  const { data, error } = await supabase
    .from("submissions")
    .select("exercise_id, status, exercises(title, language)")
    .eq("student_id", studentId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as unknown as {
    exercise_id: string;
    status: string;
    exercises: { title: string | null; language: string } | null;
  };
  return {
    exercise_id: row.exercise_id,
    title: row.exercises?.title ?? "Ejercicio",
    language: row.exercises?.language ?? "pseint",
    status: row.status,
  };
}

function startOfWeekISO(): string {
  const now = new Date();
  const day = (now.getDay() + 6) % 7; // lunes = 0
  const monday = new Date(now);
  monday.setDate(now.getDate() - day);
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString();
}

/** Stats reales para logros y reto semanal. */
export async function fetchGameStats(
  studentId: string,
  xp: number,
  streak: number,
): Promise<GameStats> {
  const [gradedRes, bestRes, weekRes] = await Promise.all([
    supabase
      .from("submissions")
      .select("id", { count: "exact", head: true })
      .eq("student_id", studentId)
      .eq("status", "graded"),
    supabase
      .from("submissions")
      .select("score")
      .eq("student_id", studentId)
      .not("score", "is", null)
      .order("score", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("submissions")
      .select("id", { count: "exact", head: true })
      .eq("student_id", studentId)
      .eq("status", "graded")
      .gte("submitted_at", startOfWeekISO()),
  ]);

  return {
    xp,
    streak,
    gradedCount: gradedRes.count ?? 0,
    bestScore: (bestRes.data as { score: number } | null)?.score ?? 0,
    weekCount: weekRes.count ?? 0,
  };
}
