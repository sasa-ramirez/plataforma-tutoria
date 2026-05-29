import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchAssignments,
  fetchAssignment,
  createAssignment,
  updateAssignmentStatus,
  fetchExercisesByAssignment,
  fetchExercise,
  createExercise,
  type CreateAssignmentInput,
  type CreateExerciseInput,
} from "@/services/assignments";
import type { AssignmentStatus } from "@/types/database";

export const assignmentKeys = {
  byCourse: (courseId: string) => ["assignments", "course", courseId] as const,
  detail: (id: string) => ["assignments", "detail", id] as const,
  exercises: (assignmentId: string) =>
    ["exercises", "assignment", assignmentId] as const,
  exercise: (id: string) => ["exercise", id] as const,
};

export function useAssignments(courseId: string) {
  return useQuery({
    queryKey: assignmentKeys.byCourse(courseId),
    queryFn: () => fetchAssignments(courseId),
    enabled: !!courseId,
  });
}

export function useAssignment(id: string) {
  return useQuery({
    queryKey: assignmentKeys.detail(id),
    queryFn: () => fetchAssignment(id),
    enabled: !!id,
  });
}

export function useCreateAssignment(courseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateAssignmentInput) => createAssignment(input),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: assignmentKeys.byCourse(courseId) }),
  });
}

export function useUpdateAssignmentStatus(courseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: AssignmentStatus }) =>
      updateAssignmentStatus(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: assignmentKeys.byCourse(courseId) });
    },
  });
}

export function useExercises(assignmentId: string) {
  return useQuery({
    queryKey: assignmentKeys.exercises(assignmentId),
    queryFn: () => fetchExercisesByAssignment(assignmentId),
    enabled: !!assignmentId,
  });
}

export function useExercise(id: string) {
  return useQuery({
    queryKey: assignmentKeys.exercise(id),
    queryFn: () => fetchExercise(id),
    enabled: !!id,
  });
}

export function useCreateExercise(assignmentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateExerciseInput) => createExercise(input),
    onSuccess: () =>
      qc.invalidateQueries({
        queryKey: assignmentKeys.exercises(assignmentId),
      }),
  });
}
