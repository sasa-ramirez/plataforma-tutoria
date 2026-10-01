import { supabase } from "@/lib/supabase";
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
