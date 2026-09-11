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
  isExam = false,
): Promise<Submission> {
  const latest = await fetchLatestSubmission(exerciseId);
  // Si la última sigue siendo borrador, la reusamos.
  if (latest && latest.status === "draft") return latest;

  // Modo examen: un solo intento. Si ya hay una entrega enviada (no un
  // error transitorio de la IA), no se crea un intento nuevo — se
  // devuelve la existente para mostrarla de solo lectura.
  if (isExam && latest && latest.status !== "error") return latest;

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

    // Intenta extraer el mensaje REAL que devolvió la Edge Function.
    let detail = error.message;
    try {
      const ctx = (error as { context?: Response }).context;
      if (ctx && typeof ctx.json === "function") {
        const body = await ctx.json();
        if (body?.error) detail = body.error;
      }
    } catch {
      /* si no se puede leer el cuerpo, queda error.message */
    }
    return { ok: false, error: friendlyReviewError(detail) };
  }

  // La función pudo responder 200 pero con ok:false (error controlado).
  const result = data as ReviewResult;
  if (!result?.ok) {
    await supabase
      .from("submissions")
      .update({ status: "error" })
      .eq("id", submissionId);
    return { ok: false, error: friendlyReviewError(result?.error ?? "") };
  }
  return result;
}

/** El detalle técnico (JSON crudo de OpenRouter, stacktraces, etc.) es útil
 * en consola pero no debe llegarle así a un estudiante — se cambia por un
 * mensaje claro, distinguiendo el caso de "modelo gratis saturado" (que sí
 * conviene reintentar en un rato) del resto. */
function friendlyReviewError(detail: string): string {
  if (detail) console.error("[ai-review]", detail);
  if (/429|rate.?limit|saturad/i.test(detail)) {
    return "La IA está saturada en este momento (mucha gente usándola a la vez). Vuelve a intentarlo en unos minutos.";
  }
  return "No se pudo revisar tu ejercicio con IA en este momento. Vuelve a intentarlo en un rato.";
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
