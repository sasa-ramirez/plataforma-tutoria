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
} from "@/services/quiz";
import type { QuizMode } from "@/types/database";

export function useQuizSession(sessionId: string) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["quiz", "session", sessionId],
    queryFn: () => fetchQuizSession(sessionId),
    enabled: !!sessionId,
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
      .subscribe();
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
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId, qc]);

  return query;
}

export function useStartQuizSession() {
  return useMutation({
    mutationFn: ({ assignmentId, mode }: { assignmentId: string; mode: QuizMode }) =>
      startQuizSession(assignmentId, mode),
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
