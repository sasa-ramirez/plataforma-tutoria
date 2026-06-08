import { supabase } from "@/lib/supabase";
import type { Difficulty, Exercise, ProgLanguage } from "@/types/database";
import { STARTER_CODE } from "@/lib/constants";

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

/**
 * Práctica libre con IA: pide a la IA un enunciado según lenguaje/dificultad/
 * tema, crea el ejercicio de práctica (privado del alumno) y devuelve su id
 * para abrir la pantalla de resolución (donde la misma IA lo califica).
 */
export async function generatePracticeExercise(input: {
  language: ProgLanguage;
  difficulty: Difficulty;
  topic: string;
}): Promise<string> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) throw new Error("No autenticado");

  // Títulos recientes del alumno (mismo lenguaje) para no repetir ejercicios.
  const { data: recent } = await supabase
    .from("exercises")
    .select("title")
    .eq("is_practice", true)
    .eq("created_by", uid)
    .eq("language", input.language)
    .order("created_at", { ascending: false })
    .limit(20);
  const avoid = (recent ?? []).map((r) => (r as { title: string }).title);

  const { data, error } = await supabase.functions.invoke("ai-generate", {
    body: { ...input, avoid },
  });
  if (error) throw new Error(error.message);
  if (!data?.ok) throw new Error(data?.error ?? "La IA no pudo generar el ejercicio");

  const { data: created, error: insErr } = await supabase
    .from("exercises")
    .insert({
      is_practice: true,
      created_by: uid,
      title: data.title,
      prompt: data.prompt,
      starter_code: STARTER_CODE[input.language] ?? "",
      solution_code: data.solution_code ?? null,
      language: input.language,
      difficulty: input.difficulty,
      points: 100,
    })
    .select("id")
    .single();
  if (insErr) throw insErr;
  return (created as { id: string }).id;
}
