import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import {
  startQuizSession,
  joinQuiz,
  submitQuizAnswer,
  startQuiz,
  nextQuizQuestion,
  endQuiz,
  fetchQuizSession,
  fetchQuizParticipants,
  fetchQuizSessionsByAssignment,
  fetchQuizSessionStats,
  fetchQuizParticipantDetail,
  fetchOpenQuizSession,
  fetchQuizPresence,
  fetchQuizReport,
  fetchCourseQuizData,
  setQuizNotes,
  reopenQuiz,
} from "@/services/quiz";
import type { QuizMode } from "@/types/database";

/** Reintenta consultas del quiz ante un fallo de red (3 veces, con espera
 * creciente) en vez de rendirse al primer error: un celular con señal
 * intermitente no debe quedarse "sin quiz". */
const QUIZ_QUERY_RETRY = {
  retry: 3,
  retryDelay: (attempt: number) => Math.min(1000 * 2 ** attempt, 8000),
} as const;

export function useQuizSession(sessionId: string) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["quiz", "session", sessionId],
    queryFn: () => fetchQuizSession(sessionId),
    enabled: !!sessionId,
    ...QUIZ_QUERY_RETRY,
    // Red de seguridad por si el tiempo real se cae: mientras el quiz no
    // termine, se vuelve a preguntar cada 8 s (es una sola fila).
    refetchInterval: (q) => (q.state.data?.status === "ended" ? false : 8_000),
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  // En vivo: cambia el estado (lobby/active/ended) o la pregunta actual
  // (modo sincronizado) sin que nadie tenga que recargar la página.
  useEffect(() => {
    if (!sessionId) return;
    const channel = supabase
      .channel(`quiz-session:${sessionId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "quiz_sessions", filter: `id=eq.${sessionId}` },
        () => qc.invalidateQueries({ queryKey: ["quiz", "session", sessionId] }),
      )
      // Al (re)conectar el canal se pide el estado actual: lo que pasó
      // mientras estuvo caído no llega por tiempo real.
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          qc.invalidateQueries({ queryKey: ["quiz", "session", sessionId] });
        }
      });
    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId, qc]);

  return query;
}

export function useQuizParticipants(sessionId: string) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["quiz", "participants", sessionId],
    queryFn: () => fetchQuizParticipants(sessionId),
    enabled: !!sessionId,
    ...QUIZ_QUERY_RETRY,
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  // Nuevo participante o puntaje que cambia: refresca el marcador solo.
  useEffect(() => {
    if (!sessionId) return;
    const channel = supabase
      .channel(`quiz-participants:${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "quiz_participants",
          filter: `session_id=eq.${sessionId}`,
        },
        () => qc.invalidateQueries({ queryKey: ["quiz", "participants", sessionId] }),
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          qc.invalidateQueries({ queryKey: ["quiz", "participants", sessionId] });
        }
      });
    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId, qc]);

  return query;
}

/** La sesión abierta de una tarea (o null). Se actualiza sola: así el
 * estudiante ve aparecer el botón "Entrar al quiz" sin recargar. */
export function useOpenQuiz(assignmentId: string) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["quiz", "open", assignmentId],
    queryFn: () => fetchOpenQuizSession(assignmentId),
    enabled: !!assignmentId,
    ...QUIZ_QUERY_RETRY,
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (!assignmentId) return;
    const channel = supabase
      .channel(`quiz-open:${assignmentId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "quiz_sessions",
          filter: `assignment_id=eq.${assignmentId}`,
        },
        () => qc.invalidateQueries({ queryKey: ["quiz", "open", assignmentId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [assignmentId, qc]);

  return query;
}

/** Última señal de cada participante, para marcar "sin señal" en el panel del profe. */
export function useQuizPresence(sessionId: string, enabled: boolean) {
  return useQuery({
    queryKey: ["quiz", "presence", sessionId],
    queryFn: () => fetchQuizPresence(sessionId),
    enabled: !!sessionId && enabled,
    refetchInterval: 10_000,
  });
}

export function useQuizReport(assignmentId: string) {
  return useQuery({
    queryKey: ["quiz", "report", assignmentId],
    queryFn: () => fetchQuizReport(assignmentId),
    enabled: !!assignmentId,
  });
}

export function useSetQuizNotes(assignmentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ sessionId, notes }: { sessionId: string; notes: string }) =>
      setQuizNotes(sessionId, notes),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["quiz", "report", assignmentId] }),
  });
}

export function useReopenQuiz() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) => reopenQuiz(sessionId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["quiz"] }),
  });
}

export function useStartQuizSession() {
  const qc = useQueryClient();
  return useMutation({
    onSuccess: () => qc.invalidateQueries({ queryKey: ["quiz"] }),
    mutationFn: ({
      assignmentId,
      mode,
      shuffle,
    }: {
      assignmentId: string;
      mode: QuizMode;
      shuffle?: boolean;
    }) => startQuizSession(assignmentId, mode, shuffle),
  });
}

export function useQuizSessionsByAssignment(assignmentId: string) {
  return useQuery({
    queryKey: ["quiz", "sessions", assignmentId],
    queryFn: () => fetchQuizSessionsByAssignment(assignmentId),
    enabled: !!assignmentId,
  });
}

export function useQuizSessionStats(sessionId: string) {
  return useQuery({
    queryKey: ["quiz", "stats", sessionId],
    queryFn: () => fetchQuizSessionStats(sessionId),
    enabled: !!sessionId,
  });
}

export function useQuizParticipantDetail(participantId: string | null | undefined, enabled = true) {
  return useQuery({
    queryKey: ["quiz", "participant-detail", participantId],
    queryFn: () => fetchQuizParticipantDetail(participantId as string),
    enabled: !!participantId && enabled,
  });
}

export function useJoinQuiz() {
  return useMutation({ mutationFn: (sessionId: string) => joinQuiz(sessionId) });
}

export function useSubmitQuizAnswer() {
  return useMutation({
    mutationFn: ({
      sessionId,
      exerciseId,
      selected,
    }: {
      sessionId: string;
      exerciseId: string;
      selected: number;
    }) => submitQuizAnswer(sessionId, exerciseId, selected),
  });
}

export function useStartQuiz() {
  return useMutation({ mutationFn: (sessionId: string) => startQuiz(sessionId) });
}

export function useNextQuizQuestion() {
  return useMutation({ mutationFn: (sessionId: string) => nextQuizQuestion(sessionId) });
}

export function useEndQuiz() {
  return useMutation({ mutationFn: (sessionId: string) => endQuiz(sessionId) });
}

export function useCourseQuizData(courseId: string) {
  return useQuery({
    queryKey: ["quiz", "course-data", courseId],
    queryFn: () => fetchCourseQuizData(courseId),
    enabled: !!courseId,
  });
}
