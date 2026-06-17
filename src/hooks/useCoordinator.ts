import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchOverview,
  fetchGroups,
  fetchGroupAssignments,
  fetchStudents,
  fetchStudentSubmissions,
  createGroup,
  addStudents,
} from "@/services/coordinator";

export function useCoordOverview() {
  return useQuery({ queryKey: ["coord", "overview"], queryFn: fetchOverview });
}

export function useCoordGroups() {
  return useQuery({ queryKey: ["coord", "groups"], queryFn: fetchGroups });
}

export function useCoordGroupAssignments(courseId: string | null) {
  return useQuery({
    queryKey: ["coord", "group-assignments", courseId],
    queryFn: () => fetchGroupAssignments(courseId as string),
    enabled: !!courseId,
  });
}

export function useCoordStudents() {
  return useQuery({ queryKey: ["coord", "students"], queryFn: fetchStudents });
}

export function useCoordStudentSubmissions(studentId: string | null) {
  return useQuery({
    queryKey: ["coord", "student-subs", studentId],
    queryFn: () => fetchStudentSubmissions(studentId as string),
    enabled: !!studentId,
  });
}

export function useCreateGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createGroup,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["coord", "groups"] });
      qc.invalidateQueries({ queryKey: ["coord", "overview"] });
    },
  });
}

export function useAddStudents(courseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (emails: string[]) => addStudents(courseId, emails),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["coord", "groups"] });
    },
  });
}
