import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import {
  fetchTeacherCourses,
  fetchStudentCourses,
  fetchCourse,
  fetchCourseMembers,
  createCourse,
  joinCourseByCode,
  softDeleteCourse,
} from "@/services/courses";

export const courseKeys = {
  all: ["courses"] as const,
  teacher: (id: string) => ["courses", "teacher", id] as const,
  student: ["courses", "student"] as const,
  detail: (id: string) => ["courses", "detail", id] as const,
  members: (id: string) => ["courses", "members", id] as const,
};

export function useCourse(courseId: string) {
  return useQuery({
    queryKey: courseKeys.detail(courseId),
    queryFn: () => fetchCourse(courseId),
    enabled: !!courseId,
  });
}

export function useCourseMembers(courseId: string, enabled = true) {
  return useQuery({
    queryKey: courseKeys.members(courseId),
    queryFn: () => fetchCourseMembers(courseId),
    enabled: !!courseId && enabled,
  });
}

/** Lista de cursos según el rol del usuario actual. */
export function useCourses() {
  const { profile, isTeacher } = useAuth();
  const teacherId = profile?.id ?? "";

  const teacherQuery = useQuery({
    queryKey: courseKeys.teacher(teacherId),
    queryFn: () => fetchTeacherCourses(teacherId),
    enabled: isTeacher && !!teacherId,
  });

  const studentQuery = useQuery({
    queryKey: courseKeys.student,
    queryFn: fetchStudentCourses,
    enabled: !isTeacher && !!profile,
  });

  return isTeacher ? teacherQuery : studentQuery;
}

export function useCreateCourse() {
  const qc = useQueryClient();
  const { profile } = useAuth();
  return useMutation({
    mutationFn: (input: { title: string; description?: string; color?: string }) =>
      createCourse({ ...input, teacher_id: profile!.id }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: courseKeys.teacher(profile!.id) }),
  });
}

export function useJoinCourse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => joinCourseByCode(code),
    onSuccess: () => qc.invalidateQueries({ queryKey: courseKeys.student }),
  });
}

export function useDeleteCourse() {
  const qc = useQueryClient();
  const { profile } = useAuth();
  return useMutation({
    mutationFn: (id: string) => softDeleteCourse(id),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: courseKeys.teacher(profile!.id) }),
  });
}
