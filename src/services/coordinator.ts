import { supabase } from "@/lib/supabase";

export interface CoordOverview {
  students: number;
  teachers: number;
  courses: number;
  assignments: number;
  submissions: number;
  avg_score: number;
}

export interface CoordGroup {
  course_id: string;
  title: string;
  teacher_name: string | null;
  subject_name: string | null;
  schedule: string | null;
  join_code: string | null;
  students: number;
  assignments: number;
  submissions: number;
  avg_score: number | null;
}

export interface CoordGroupAssignment {
  id: string;
  title: string;
  status: string;
  difficulty: string;
  closes_at: string | null;
  exercises: number;
}

export interface CoordStudent {
  student_id: string;
  full_name: string | null;
  email: string;
  courses: number;
  submissions: number;
  avg_score: number | null;
  xp: number;
  streak: number;
  last_active: string | null;
}

export interface CoordStudentSubmission {
  course_title: string | null;
  exercise_title: string;
  type: string;
  status: string;
  score: number | null;
  submitted_at: string | null;
}

export async function fetchOverview(): Promise<CoordOverview> {
  const { data, error } = await supabase.rpc("coord_overview");
  if (error) throw new Error(error.message);
  return data as CoordOverview;
}

export async function fetchGroups(): Promise<CoordGroup[]> {
  const { data, error } = await supabase.rpc("coord_groups");
  if (error) throw new Error(error.message);
  return (data ?? []) as CoordGroup[];
}

export async function fetchGroupAssignments(
  courseId: string,
): Promise<CoordGroupAssignment[]> {
  const { data, error } = await supabase.rpc("coord_group_assignments", {
    p_course: courseId,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as CoordGroupAssignment[];
}

export async function fetchStudents(): Promise<CoordStudent[]> {
  const { data, error } = await supabase.rpc("coord_students");
  if (error) throw new Error(error.message);
  return (data ?? []) as CoordStudent[];
}

export async function fetchStudentSubmissions(
  studentId: string,
): Promise<CoordStudentSubmission[]> {
  const { data, error } = await supabase.rpc("coord_student_submissions", {
    p_student: studentId,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as CoordStudentSubmission[];
}

/** Crea un grupo, asigna tutor (lo vuelve profesor) y devuelve su código. */
export async function createGroup(input: {
  title: string;
  subjectId: string;
  tutorEmail: string;
  schedule: string;
}): Promise<{ course_id: string; join_code: string }> {
  const { data, error } = await supabase.rpc("coord_create_group", {
    p_title: input.title,
    p_subject_id: input.subjectId,
    p_tutor_email: input.tutorEmail,
    p_schedule: input.schedule,
  });
  if (error) throw new Error(error.message);
  return data as { course_id: string; join_code: string };
}

/** Inscribe estudiantes por correo y los notifica. Devuelve cuántos y cuáles faltan. */
export async function addStudents(
  courseId: string,
  emails: string[],
): Promise<{ added: number; missing: string[] }> {
  const { data, error } = await supabase.rpc("coord_add_students", {
    p_course: courseId,
    p_emails: emails,
  });
  if (error) throw new Error(error.message);
  return data as { added: number; missing: string[] };
}
