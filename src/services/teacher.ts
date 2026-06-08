import { supabase } from "@/lib/supabase";
import type {
  AIFeedback,
  ExamLog,
  ProgLanguage,
  SubmissionStatus,
} from "@/types/database";

export interface SubmissionRow {
  id: string;
  student_id: string;
  student_name: string | null;
  status: SubmissionStatus;
  score: number | null;
  attempt: number;
  submitted_at: string | null;
  code: string;
  language: ProgLanguage;
  feedback: AIFeedback | null;
  exit_count: number;
  paste_count: number;
}

/** Entregas de un ejercicio: alumno, nota, CÓDIGO entregado, feedback de IA y examen. */
export async function fetchSubmissionsForExercise(
  exerciseId: string,
): Promise<SubmissionRow[]> {
  const { data, error } = await supabase
    .from("submissions")
    .select(
      "id, student_id, status, score, attempt, submitted_at, code, language, profiles(full_name), ai_feedback(*), exam_logs(event_type)",
    )
    .eq("exercise_id", exerciseId)
    .neq("status", "draft")
    .order("submitted_at", { ascending: false });
  if (error) throw error;

  return (data ?? []).map((row) => {
    // deno/ts: relaciones vienen como objeto/array
    const r = row as unknown as {
      id: string;
      student_id: string;
      status: SubmissionStatus;
      score: number | null;
      attempt: number;
      submitted_at: string | null;
      code: string;
      language: ProgLanguage;
      profiles: { full_name: string | null } | null;
      ai_feedback: AIFeedback | AIFeedback[] | null;
      exam_logs: { event_type: string }[];
    };
    const logs = r.exam_logs ?? [];
    const fb = Array.isArray(r.ai_feedback) ? r.ai_feedback[0] : r.ai_feedback;
    return {
      id: r.id,
      student_id: r.student_id,
      student_name: r.profiles?.full_name ?? null,
      status: r.status,
      score: r.score,
      attempt: r.attempt,
      submitted_at: r.submitted_at,
      code: r.code ?? "",
      language: r.language,
      feedback: fb ?? null,
      exit_count: logs.filter((l) => l.event_type === "window_hidden").length,
      paste_count: logs.filter((l) => l.event_type === "paste").length,
    };
  });
}

/** Timeline completo de eventos de examen de una entrega. */
export async function fetchExamLogs(submissionId: string): Promise<ExamLog[]> {
  const { data, error } = await supabase
    .from("exam_logs")
    .select("*")
    .eq("submission_id", submissionId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as ExamLog[];
}
