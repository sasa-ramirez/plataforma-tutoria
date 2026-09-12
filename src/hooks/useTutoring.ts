import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchSessions,
  fetchSessionAttendance,
  createSessionWithAttendance,
  deleteSession,
  updateProfessorName,
  setScheduleManually,
} from "@/services/tutoring";
import { courseKeys } from "@/hooks/useCourses";
import type { TutoringSessionType } from "@/types/database";

export function useTutoringSessions(courseId: string) {
  return useQuery({
    queryKey: ["tutoring", "sessions", courseId],
    queryFn: () => fetchSessions(courseId),
    enabled: !!courseId,
  });
}

export function useSessionAttendance(sessionId: string | null) {
  return useQuery({
    queryKey: ["tutoring", "session-attendance", sessionId],
    queryFn: () => fetchSessionAttendance(sessionId as string),
    enabled: !!sessionId,
  });
}

export function useCreateSession(courseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      sessionDate: string;
      type: TutoringSessionType;
      topic: string;
      attendance: { student_id: string; present: boolean }[];
    }) => createSessionWithAttendance({ courseId, ...input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tutoring", "sessions", courseId] });
    },
  });
}

export function useDeleteSession(courseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) => deleteSession(sessionId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tutoring", "sessions", courseId] });
    },
  });
}

export function useUpdateProfessorName(courseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => updateProfessorName(courseId, name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: courseKeys.detail(courseId) });
    },
  });
}

export function useSetScheduleManually(courseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (schedule: string) => setScheduleManually(courseId, schedule),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: courseKeys.detail(courseId) });
    },
  });
}
