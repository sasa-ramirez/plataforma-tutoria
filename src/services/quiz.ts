import { supabase } from "@/lib/supabase";
import { fetchCourseMembers } from "@/services/courses";
import type { ConsolidatedData } from "@/lib/quizConsolidated";
import type { QuizMode, QuizSession, QuizParticipant } from "@/types/database";

export async function startQuizSession(
  assignmentId: string,
  mode: QuizMode,
  shuffle = false,
): Promise<string> {
  const { data, error } = await supabase.rpc("quiz_start_session", {
    p_assignment: assignmentId,
    p_mode: mode,
    p_shuffle: shuffle,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function joinQuiz(sessionId: string): Promise<void> {
  const { error } = await supabase.rpc("quiz_join", { p_session: sessionId });
  if (error) throw new Error(error.message);
}

export interface QuizAnswerResult {
  correct: boolean;
  points: number;
}

export async function submitQuizAnswer(
  sessionId: string,
  exerciseId: string,
  selected: number,
): Promise<QuizAnswerResult> {
  const { data, error } = await supabase.rpc("quiz_submit_answer", {
    p_session: sessionId,
    p_exercise: exerciseId,
    p_selected: selected,
  });
  if (error) throw new Error(error.message);
  return data as QuizAnswerResult;
}

export async function startQuiz(sessionId: string): Promise<void> {
  const { error } = await supabase.rpc("quiz_start", { p_session: sessionId });
  if (error) throw new Error(error.message);
}

export async function nextQuizQuestion(sessionId: string): Promise<{ ended: boolean }> {
  const { data, error } = await supabase.rpc("quiz_next", { p_session: sessionId });
  if (error) throw new Error(error.message);
  return data as { ended: boolean };
}

export async function endQuiz(sessionId: string): Promise<void> {
  const { error } = await supabase.rpc("quiz_end", { p_session: sessionId });
  if (error) throw new Error(error.message);
}

export async function fetchQuizSession(sessionId: string): Promise<QuizSession | null> {
  const { data, error } = await supabase
    .from("quiz_sessions")
    .select("*")
    .eq("id", sessionId)
    .maybeSingle();
  if (error) throw error;
  return (data as QuizSession) ?? null;
}

/** Participantes ordenados por puntaje (para el marcador en vivo). */
export async function fetchQuizParticipants(sessionId: string): Promise<QuizParticipant[]> {
  const { data, error } = await supabase
    .from("quiz_participants")
    .select("*, profiles(full_name)")
    .eq("session_id", sessionId)
    .order("score", { ascending: false })
    .order("joined_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => {
    const r = row as unknown as QuizParticipant & {
      profiles: { full_name: string | null } | null;
    };
    return { ...r, full_name: r.profiles?.full_name ?? null };
  });
}

/** Historial de quizzes (pasados y en curso) de una tarea, más recientes primero. */
export async function fetchQuizSessionsByAssignment(
  assignmentId: string,
): Promise<QuizSession[]> {
  const { data, error } = await supabase
    .from("quiz_sessions")
    .select("*")
    .eq("assignment_id", assignmentId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as QuizSession[];
}

/** La sesión abierta (sala de espera o en curso) de una tarea, si hay una.
 * Solo puede haber una por tarea (migración 0037). */
export async function fetchOpenQuizSession(assignmentId: string): Promise<QuizSession | null> {
  const { data, error } = await supabase
    .from("quiz_sessions")
    .select("*")
    .eq("assignment_id", assignmentId)
    .neq("status", "ended")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as QuizSession) ?? null;
}

/** "Sigo aquí": el celular lo manda cada ~20 s para que el profe vea quién perdió señal. */
export async function quizHeartbeat(sessionId: string): Promise<void> {
  const { error } = await supabase.rpc("quiz_heartbeat", { p_session: sessionId });
  if (error) throw new Error(error.message);
}

/** Bitácora desde el celular. Nunca debe romper el quiz: se traga sus propios errores. */
export async function logQuizEvent(
  sessionId: string,
  kind: "offline" | "error",
  detail?: Record<string, unknown>,
): Promise<void> {
  try {
    await supabase.rpc("quiz_log_event", {
      p_session: sessionId,
      p_kind: kind,
      p_detail: detail ?? null,
    });
  } catch {
    /* sin conexión: ya es justo lo que se intenta anotar */
  }
}

export async function reopenQuiz(sessionId: string): Promise<void> {
  const { error } = await supabase.rpc("quiz_reopen", { p_session: sessionId });
  if (error) throw new Error(error.message);
}

export async function setQuizNotes(sessionId: string, notes: string): Promise<void> {
  const { error } = await supabase.rpc("quiz_set_notes", { p_session: sessionId, p_notes: notes });
  if (error) throw new Error(error.message);
}

/** Última señal de cada participante (solo el profe dueño lo puede leer). */
export async function fetchQuizPresence(
  sessionId: string,
): Promise<Record<string, string>> {
  const { data, error } = await supabase
    .from("quiz_presence")
    .select("participant_id, last_seen_at")
    .eq("session_id", sessionId);
  if (error) throw error;
  return Object.fromEntries(
    (data ?? []).map((r) => [r.participant_id as string, r.last_seen_at as string]),
  );
}

export interface QuizReportSession {
  id: string;
  mode: QuizMode;
  shuffle: boolean;
  status: "lobby" | "active" | "ended";
  created_at: string;
  started_at: string | null;
  ended_at: string | null;
  notes: string | null;
  participants: {
    student_id: string;
    score: number;
    answered: number;
    correct: number;
    joined_at: string;
    last_seen_at: string | null;
    last_answer_at: string | null;
  }[];
  per_question: { exercise_id: string; total: number; correct: number }[];
  events: {
    student_id: string;
    kind: "join" | "rejoin" | "offline" | "error";
    detail: Record<string, unknown> | null;
    at: string;
  }[];
}

export interface QuizReport {
  assignment: { id: string; title: string; course_name: string | null };
  questions: { id: string; title: string }[];
  roster: { id: string; full_name: string | null; email: string | null }[];
  sessions: QuizReportSession[];
}

/** Todo lo necesario para el informe de una tarea (todos sus quizzes). */
export async function fetchQuizReport(assignmentId: string): Promise<QuizReport> {
  const { data, error } = await supabase.rpc("quiz_report", { p_assignment: assignmentId });
  if (error) throw new Error(error.message);
  return data as QuizReport;
}

export interface QuizQuestionStat {
  exercise_id: string;
  title: string;
  prompt: string;
  options: string[];
  correct_index: number;
  order_index: number;
  total_answers: number;
  correct_answers: number;
}

/** Resultados globales: por cada pregunta, cuántos respondieron y cuántos acertaron. */
export async function fetchQuizSessionStats(sessionId: string): Promise<QuizQuestionStat[]> {
  const { data, error } = await supabase.rpc("quiz_session_stats", { p_session: sessionId });
  if (error) throw new Error(error.message);
  return (data ?? []) as QuizQuestionStat[];
}

export interface QuizParticipantAnswer {
  exercise_id: string;
  title: string;
  prompt: string;
  options: string[];
  correct_index: number;
  selected: number;
  is_correct: boolean;
  answered_at: string;
  order_index: number;
}

/** Resultado individual: cada pregunta que respondió ese participante, con la correcta. */
export async function fetchQuizParticipantDetail(
  participantId: string,
): Promise<QuizParticipantAnswer[]> {
  const { data, error } = await supabase.rpc("quiz_participant_detail", {
    p_participant: participantId,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as QuizParticipantAnswer[];
}

/** Trae todas las filas de una consulta paginando (Supabase corta en 1000). */
async function fetchAll<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const out: T[] = [];
  const size = 1000;
  for (let from = 0; ; from += size) {
    const { data, error } = await build(from, from + size - 1);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < size) break;
  }
  return out;
}

/** Todo lo necesario para el consolidado de un curso: sesiones, participantes,
 * respuestas, preguntas y lista de inscritos (solo el profesor dueño puede leerlo). */
export async function fetchCourseQuizData(courseId: string): Promise<ConsolidatedData> {
  const { data: sessions, error } = await supabase
    .from("quiz_sessions")
    .select("id, assignment_id")
    .eq("course_id", courseId);
  if (error) throw new Error(error.message);
  const sessionIds = (sessions ?? []).map((s) => s.id as string);
  const assignmentIds = [...new Set((sessions ?? []).map((s) => s.assignment_id as string))];
  if (sessionIds.length === 0) {
    return { sessions: [], assignments: [], participants: [], answers: [], exercises: [], roster: [] };
  }

  const [assignments, participants, answers, exercises, roster] = await Promise.all([
    supabase.from("assignments").select("id, title").in("id", assignmentIds),
    fetchAll<ConsolidatedData["participants"][number]>((f, t) =>
      supabase.from("quiz_participants").select("id, session_id, student_id").in("session_id", sessionIds).range(f, t),
    ),
    fetchAll<ConsolidatedData["answers"][number]>((f, t) =>
      supabase.from("quiz_answers").select("participant_id, exercise_id, correct").in("session_id", sessionIds).range(f, t),
    ),
    supabase
      .from("exercises")
      .select("id, assignment_id, title, quiz_batch_topic, deleted_at")
      .in("assignment_id", assignmentIds)
      .eq("type", "multiple_choice"),
    fetchCourseMembers(courseId),
  ]);
  if (assignments.error) throw new Error(assignments.error.message);
  if (exercises.error) throw new Error(exercises.error.message);

  return {
    sessions: (sessions ?? []) as ConsolidatedData["sessions"],
    assignments: (assignments.data ?? []) as ConsolidatedData["assignments"],
    participants,
    answers,
    exercises: (exercises.data ?? []).map((e) => ({
      id: e.id as string,
      assignment_id: e.assignment_id as string,
      title: e.title as string,
      topic: (e.quiz_batch_topic as string | null) ?? null,
      deleted_at: (e.deleted_at as string | null) ?? null,
    })),
    roster,
  };
}
