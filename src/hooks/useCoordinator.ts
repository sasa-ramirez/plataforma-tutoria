import { useQuery } from "@tanstack/react-query";
import {
  fetchOverview,
  fetchGroups,
  fetchGroupAssignments,
  fetchStudents,
  fetchStudentSubmissions,
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
