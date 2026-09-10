import {
  useMutation,
  useQuery,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import {
  fetchOverview,
  fetchGroups,
  fetchGroupAssignments,
  fetchStudents,
  fetchStudentSubmissions,
  fetchGroupStudents,
  fetchTeachers,
  fetchTeacherGroups,
  createGroup,
  addStudents,
  removeStudent,
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

export function useCoordStudents(opts: { search?: string; page?: number } = {}) {
  const search = opts.search?.trim() ?? "";
  const page = opts.page ?? 0;
  return useQuery({
    queryKey: ["coord", "students", search, page],
    queryFn: () => fetchStudents({ search, page }),
    placeholderData: keepPreviousData,
  });
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
      qc.invalidateQueries({ queryKey: ["coord", "group-students", courseId] });
    },
  });
}

export function useCoordGroupStudents(courseId: string | null) {
  return useQuery({
    queryKey: ["coord", "group-students", courseId],
    queryFn: () => fetchGroupStudents(courseId as string),
    enabled: !!courseId,
  });
}

export function useCoordTeachers(opts: { search?: string; page?: number } = {}) {
  const search = opts.search?.trim() ?? "";
  const page = opts.page ?? 0;
  return useQuery({
    queryKey: ["coord", "teachers", search, page],
    queryFn: () => fetchTeachers({ search, page }),
    placeholderData: keepPreviousData,
  });
}

export function useCoordTeacherGroups(teacherId: string | null) {
  return useQuery({
    queryKey: ["coord", "teacher-groups", teacherId],
    queryFn: () => fetchTeacherGroups(teacherId as string),
    enabled: !!teacherId,
  });
}

export function useRemoveStudent(courseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (studentId: string) => removeStudent(courseId, studentId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["coord", "groups"] });
      qc.invalidateQueries({ queryKey: ["coord", "group-students", courseId] });
      qc.invalidateQueries({ queryKey: ["coord", "students"] });
    },
  });
}
