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
  course_names: string | null;
  submissions: number;
  avg_score: number | null;
  xp: number;
  streak: number;
  last_active: string | null;
  login_count: number;
  last_login: string | null;
}

export interface CoordTeacher {
  teacher_id: string;
  full_name: string | null;
  email: string;
  groups: number;
  students: number;
  submissions: number;
  avg_score: number | null;
  login_count: number;
  last_login: string | null;
}

export interface CoordTeacherGroup {
  course_id: string;
  title: string;
  subject_name: string | null;
  schedule: string | null;
  students: number;
  assignments: number;
  avg_score: number | null;
}

export interface CoordStudentSubmission {
  course_title: string | null;
  exercise_title: string;
  type: string;
  status: string;
  score: number | null;
  submitted_at: string | null;
}

export interface CoordGroupStudent {
  student_id: string;
  full_name: string | null;
  email: string;
  submissions: number;
  avg_score: number | null;
  enrolled_at: string;
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

export interface CoordStudentsPage {
  rows: CoordStudent[];
  total: number;
}

export const STUDENTS_PAGE_SIZE = 20;

/**
 * Estudiantes con búsqueda y paginación (no trae a todos de una: con
 * miles de usuarios reventaría la consulta y el render del cliente).
 */
export async function fetchStudents(opts: {
  search?: string;
  page?: number;
  pageSize?: number;
} = {}): Promise<CoordStudentsPage> {
  const pageSize = opts.pageSize ?? STUDENTS_PAGE_SIZE;
  const page = opts.page ?? 0;
  const { data, error } = await supabase.rpc("coord_students", {
    p_search: opts.search?.trim() || null,
    p_limit: pageSize,
    p_offset: page * pageSize,
  });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as (CoordStudent & { total_count: number })[];
  const total = rows[0]?.total_count ?? 0;
  return {
    rows: rows.map(({ total_count: _total_count, ...r }) => r),
    total,
  };
}

export interface CoordTeachersPage {
  rows: CoordTeacher[];
  total: number;
}

export const TEACHERS_PAGE_SIZE = 20;

/** Tutores con búsqueda y paginación (mismo patrón que fetchStudents). */
export async function fetchTeachers(opts: {
  search?: string;
  page?: number;
  pageSize?: number;
} = {}): Promise<CoordTeachersPage> {
  const pageSize = opts.pageSize ?? TEACHERS_PAGE_SIZE;
  const page = opts.page ?? 0;
  const { data, error } = await supabase.rpc("coord_teachers", {
    p_search: opts.search?.trim() || null,
    p_limit: pageSize,
    p_offset: page * pageSize,
  });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as (CoordTeacher & { total_count: number })[];
  const total = rows[0]?.total_count ?? 0;
  return {
    rows: rows.map(({ total_count: _total_count, ...r }) => r),
    total,
  };
}

/** Grupos que dicta un tutor (reporte individual). */
export async function fetchTeacherGroups(
  teacherId: string,
): Promise<CoordTeacherGroup[]> {
  const { data, error } = await supabase.rpc("coord_teacher_groups", {
    p_teacher: teacherId,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as CoordTeacherGroup[];
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

/** Estudiantes inscritos en un grupo (para poder quitarlos). */
export async function fetchGroupStudents(
  courseId: string,
): Promise<CoordGroupStudent[]> {
  const { data, error } = await supabase.rpc("coord_group_students", {
    p_course: courseId,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as CoordGroupStudent[];
}

/** Quita a un estudiante de un grupo (y lo notifica). */
export async function removeStudent(
  courseId: string,
  studentId: string,
): Promise<void> {
  const { error } = await supabase.rpc("coord_remove_student", {
    p_course: courseId,
    p_student: studentId,
  });
  if (error) throw new Error(error.message);
}

// ---------- Cuentas sin confirmar ----------

export interface CoordUnconfirmed {
  user_id: string;
  email: string;
  full_name: string | null;
  created_at: string;
}

export async function fetchUnconfirmed(): Promise<CoordUnconfirmed[]> {
  const { data, error } = await supabase.rpc("coord_unconfirmed_accounts");
  if (error) throw new Error(error.message);
  return (data ?? []) as CoordUnconfirmed[];
}

/** Confirma el correo de las cuentas indicadas. Devuelve cuántas se confirmaron. */
export async function confirmAccounts(userIds: string[]): Promise<number> {
  const { data, error } = await supabase.rpc("coord_confirm_accounts", {
    p_users: userIds,
  });
  if (error) throw new Error(error.message);
  return (data as number) ?? 0;
}

/** Borra una cuenta que NUNCA se confirmó (p. ej. con el correo mal escrito). */
export async function deleteUnconfirmed(userId: string): Promise<void> {
  const { error } = await supabase.rpc("coord_delete_unconfirmed", {
    p_user: userId,
  });
  if (error) throw new Error(error.message);
}
