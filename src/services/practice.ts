import { supabase } from "@/lib/supabase";
import type { Exercise } from "@/types/database";

/** Ejercicios de práctica libre (visibles para cualquier autenticado). */
export async function fetchPracticeExercises(): Promise<Exercise[]> {
  const { data, error } = await supabase
    .from("exercises")
    .select("*")
    .eq("is_practice", true)
    .is("deleted_at", null)
    .order("order_index", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Exercise[];
}
