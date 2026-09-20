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
  started_at: string | null;
  submitted_at: string | null;
  code: string;
  language: ProgLanguage;
  answer: Record<string, unknown> | null;
  feedback: AIFeedback | null;
  exit_count: number;
  paste_count: number;
  teacher_comment: string | null;
  teacher_graded_at: string | null;
}

/** El tutor pone (o corrige) la nota de una entrega y deja un comentario. */
export async function setTeacherGrade(
  submissionId: string,
  score: number,
  comment: string,
): Promise<void> {
  const { error } = await supabase.rpc("teacher_set_grade", {
    p_submission: submissionId,
    p_score: score,
    p_comment: comment.trim() || null,
  });
  if (error) throw error;
}

/** Entregas de un ejercicio: alumno, nota, CÓDIGO entregado, feedback de IA y examen. */
export async function fetchSubmissionsForExercise(
  exerciseId: string,
): Promise<SubmissionRow[]> {
  const BASE =
    "id, student_id, status, score, attempt, started_at, submitted_at, code, language, answer";
  const REST = "profiles(full_name), ai_feedback(*), exam_logs(event_type)";
  const query = (cols: string) =>
    supabase
      .from("submissions")
      .select(cols)
      .eq("exercise_id", exerciseId)
      .neq("status", "draft")
      .order("submitted_at", { ascending: false });

  let { data, error } = await query(`${BASE}, teacher_comment, teacher_graded_at, ${REST}`);
  // Si la migración 0031 aún no está aplicada, esas columnas no existen: se
  // reintenta sin ellas para no romper el panel mientras tanto.
  if (error && (error.code === "42703" || /teacher_/.test(error.message ?? ""))) {
    ({ data, error } = await query(`${BASE}, ${REST}`));
  }
  if (error) throw error;

  return (data ?? []).map((row) => {
    // deno/ts: relaciones vienen como objeto/array
    const r = row as unknown as {
      id: string;
      student_id: string;
      status: SubmissionStatus;
      score: number | null;
      attempt: number;
      started_at: string | null;
      submitted_at: string | null;
      code: string;
      language: ProgLanguage;
      answer: Record<string, unknown> | null;
      teacher_comment: string | null;
      teacher_graded_at: string | null;
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
      started_at: r.started_at,
      submitted_at: r.submitted_at,
      code: r.code ?? "",
      language: r.language,
      answer: r.answer ?? null,
      feedback: fb ?? null,
      exit_count: logs.filter((l) => l.event_type === "window_hidden").length,
      paste_count: logs.filter((l) => l.event_type === "paste").length,
      teacher_comment: r.teacher_comment ?? null,
      teacher_graded_at: r.teacher_graded_at ?? null,
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
