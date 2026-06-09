import { supabase } from "@/lib/supabase";
import type { Course } from "@/types/database";

export interface CourseWithMeta extends Course {
  student_count: number;
}

/** Cursos creados por el profesor autenticado (con conteo de inscritos). */
export async function fetchTeacherCourses(
  teacherId: string,
): Promise<CourseWithMeta[]> {
  const { data, error } = await supabase
    .from("courses")
    .select("*, enrollments(count)")
    .eq("teacher_id", teacherId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) throw error;

  return (data ?? []).map((c) => ({
    ...(c as Course),
    // supabase devuelve enrollments: [{ count }]
    student_count:
      (c as { enrollments?: { count: number }[] }).enrollments?.[0]?.count ?? 0,
  }));
}

/** Cursos en los que está inscrito el estudiante autenticado. */
export async function fetchStudentCourses(): Promise<Course[]> {
  const { data, error } = await supabase
    .from("enrollments")
    .select("courses(*)")
    .order("created_at", { ascending: false });
  if (error) throw error;

  return (data ?? [])
    .map((row) => (row as unknown as { courses: Course | null }).courses)
    .filter(
      (c): c is Course =>
        !!c && !(c as Course & { deleted_at?: string }).deleted_at,
    );
}

export async function createCourse(input: {
  teacher_id: string;
  title: string;
  description?: string;
  color?: string;
  subject_id?: string | null;
}): Promise<Course> {
  const { subject_id, ...rest } = input;
  // Solo enviamos subject_id si se eligió asignatura, así crear cursos sigue
  // funcionando aunque la migración del catálogo aún no se haya aplicado.
  const payload = subject_id ? { ...rest, subject_id } : rest;
  const { data, error } = await supabase
    .from("courses")
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data as Course;
}

/**
 * El estudiante se une a un curso por su join_code.
 * Usa la función segura join_course_by_code (SECURITY DEFINER), porque
 * por RLS un estudiante no puede leer un curso al que aún no pertenece.
 */
export async function joinCourseByCode(
  code: string,
): Promise<{ id: string; title: string }> {
  const { data, error } = await supabase.rpc("join_course_by_code", {
    p_code: code,
  });
  if (error) throw new Error(error.message);
  const row = (data as { id: string; title: string }[] | null)?.[0];
  if (!row) throw new Error("No existe un curso con ese código.");
  return row;
}

export async function fetchCourse(courseId: string): Promise<Course> {
  const { data, error } = await supabase
    .from("courses")
    .select("*")
    .eq("id", courseId)
    .is("deleted_at", null)
    .single();
  if (error) throw error;
  return data as Course;
}

export interface CourseMember {
  id: string;
  full_name: string | null;
  email: string;
  avatar_url: string | null;
}

/** Inscritos de un curso (solo visible para el profesor dueño vía RLS). */
export async function fetchCourseMembers(
  courseId: string,
): Promise<CourseMember[]> {
  const { data, error } = await supabase
    .from("enrollments")
    .select("profiles(id, full_name, email, avatar_url)")
    .eq("course_id", courseId);
  if (error) throw error;
  return (data ?? [])
    .map((r) => (r as unknown as { profiles: CourseMember | null }).profiles)
    .filter((p): p is CourseMember => !!p);
}

export async function softDeleteCourse(courseId: string): Promise<void> {
  const { error } = await supabase
    .from("courses")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", courseId);
  if (error) throw error;
}
