import { supabase } from "@/lib/supabase";
import type {
  AIFeedback,
  ExamEvent,
  ProgLanguage,
  Submission,
} from "@/types/database";

/** Devuelve la última submission del estudiante para un ejercicio, o null. */
export async function fetchLatestSubmission(
  exerciseId: string,
): Promise<Submission | null> {
  const { data, error } = await supabase
    .from("submissions")
    .select("*")
    .eq("exercise_id", exerciseId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as Submission) ?? null;
}

/** Crea (o reusa) un borrador editable para el estudiante. */
export async function getOrCreateDraft(
  exerciseId: string,
  language: ProgLanguage,
  starter: string,
): Promise<Submission> {
  const latest = await fetchLatestSubmission(exerciseId);
  // Si la última sigue siendo borrador, la reusamos.
  if (latest && latest.status === "draft") return latest;

  const { data: userData } = await supabase.auth.getUser();
  const studentId = userData.user?.id;
  if (!studentId) throw new Error("Sesión no válida.");

  const attempt = (latest?.attempt ?? 0) + 1;
  const { data, error } = await supabase
    .from("submissions")
    .insert({
      exercise_id: exerciseId,
      student_id: studentId,
      code: latest?.code || starter,
      language,
      status: "draft",
      attempt,
      started_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) throw error;
  return data as Submission;
}

export async function saveDraft(submissionId: string, code: string) {
  const { error } = await supabase
    .from("submissions")
    .update({ code })
    .eq("id", submissionId);
  if (error) throw error;
}

export interface ReviewResult {
  ok: boolean;
  score?: number;
  feedback?: AIFeedback;
  error?: string;
}

/**
 * Marca la submission como enviada e invoca la Edge Function `ai-review`.
 * Devuelve el resultado o un error legible si la IA no está disponible.
 */
export async function submitForReview(
  submissionId: string,
  code: string,
): Promise<ReviewResult> {
  await supabase
    .from("submissions")
    .update({ code, status: "submitted", submitted_at: new Date().toISOString() })
    .eq("id", submissionId);

  const { data, error } = await supabase.functions.invoke("ai-review", {
    body: { submission_id: submissionId },
  });

  if (error) {
    await supabase
      .from("submissions")
      .update({ status: "error" })
      .eq("id", submissionId);
    return {
      ok: false,
      error:
        "No se pudo contactar a la IA. ¿Desplegaste la Edge Function 'ai-review'? (ver docs/SETUP_SUPABASE.md)",
    };
  }
  return data as ReviewResult;
}

export async function fetchFeedback(
  submissionId: string,
): Promise<AIFeedback | null> {
  const { data, error } = await supabase
    .from("ai_feedback")
    .select("*")
    .eq("submission_id", submissionId)
    .maybeSingle();
  if (error) throw error;
  return (data as AIFeedback) ?? null;
}

/** Registro anti-trampa (append-only). No bloquea, solo guarda. */
export async function logExamEvent(
  submissionId: string,
  eventType: ExamEvent,
  meta: Record<string, unknown> = {},
) {
  const { data: userData } = await supabase.auth.getUser();
  const studentId = userData.user?.id;
  if (!studentId) return;
  await supabase.from("exam_logs").insert({
    submission_id: submissionId,
    student_id: studentId,
    event_type: eventType,
    meta,
  });
}
