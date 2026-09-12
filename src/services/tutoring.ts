import { supabase } from "@/lib/supabase";
import type {
  CourseRosterRow,
  TutoringSession,
  TutoringSessionType,
} from "@/types/database";

export interface AttendanceRecord {
  student_id: string;
  full_name: string | null;
  email: string;
  present: boolean;
}

export interface SessionWithAttendance extends TutoringSession {
  present_count: number;
  total_count: number;
}

/** Sesiones de tutoría de un curso, más recientes primero, con conteo. */
export async function fetchSessions(
  courseId: string,
): Promise<SessionWithAttendance[]> {
  const { data, error } = await supabase
    .from("tutoring_sessions")
    .select("*, tutoring_attendance(present)")
    .eq("course_id", courseId)
    .order("session_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => {
    const r = row as unknown as TutoringSession & {
      tutoring_attendance: { present: boolean }[];
    };
    const att = r.tutoring_attendance ?? [];
    return {
      ...r,
      present_count: att.filter((a) => a.present).length,
      total_count: att.length,
    };
  });
}

/** Asistencia registrada de una sesión puntual (para verla/editarla). */
export async function fetchSessionAttendance(
  sessionId: string,
): Promise<AttendanceRecord[]> {
  const { data, error } = await supabase
    .from("tutoring_attendance")
    .select("student_id, present, profiles(full_name, email)")
    .eq("session_id", sessionId);
  if (error) throw error;
  return (data ?? []).map((row) => {
    const r = row as unknown as {
      student_id: string;
      present: boolean;
      profiles: { full_name: string | null; email: string } | null;
    };
    return {
      student_id: r.student_id,
      present: r.present,
      full_name: r.profiles?.full_name ?? null,
      email: r.profiles?.email ?? "",
    };
  });
}

/**
 * Crea una sesión y guarda la asistencia en un solo paso. `attendance` es
 * la lista completa de estudiantes de esa sesión (presentes y ausentes) —
 * en "planificada" es el roster del grupo; en "ocasional" los que se
 * agregaron a mano.
 */
export async function createSessionWithAttendance(input: {
  courseId: string;
  sessionDate: string;
  type: TutoringSessionType;
  topic: string;
  attendance: { student_id: string; present: boolean }[];
}): Promise<TutoringSession> {
  const { data: userData } = await supabase.auth.getUser();
  const tutorId = userData.user?.id;
  if (!tutorId) throw new Error("Sesión no válida.");

  const { data: session, error } = await supabase
    .from("tutoring_sessions")
    .insert({
      course_id: input.courseId,
      tutor_id: tutorId,
      session_date: input.sessionDate,
      type: input.type,
      topic: input.topic.trim() || null,
    })
    .select()
    .single();
  if (error) throw error;
  const sess = session as TutoringSession;

  if (input.attendance.length > 0) {
    const rows = input.attendance.map((a) => ({
      session_id: sess.id,
      student_id: a.student_id,
      present: a.present,
    }));
    const { error: attErr } = await supabase
      .from("tutoring_attendance")
      .insert(rows);
    if (attErr) throw attErr;
  }

  return sess;
}

export async function deleteSession(sessionId: string): Promise<void> {
  const { error } = await supabase
    .from("tutoring_sessions")
    .delete()
    .eq("id", sessionId);
  if (error) throw error;
}

export interface StudentSearchResult {
  id: string;
  full_name: string | null;
  email: string;
}

/** Busca estudiantes por nombre/correo (para agregar a una tutoría ocasional). */
export async function searchStudents(
  query: string,
): Promise<StudentSearchResult[]> {
  if (!query.trim()) return [];
  const { data, error } = await supabase.rpc("search_students", {
    p_query: query.trim(),
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as StudentSearchResult[];
}

/** Roster de inscritos con datos institucionales, para los reportes. */
export async function fetchCourseRoster(
  courseId: string,
): Promise<CourseRosterRow[]> {
  const { data, error } = await supabase.rpc("course_roster", {
    p_course: courseId,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as CourseRosterRow[];
}

/** Datos institucionales de estudiantes puntuales (no necesariamente
 * inscritos) — para el reporte de tutorías ocasionales. */
export async function fetchStudentsInfo(
  ids: string[],
): Promise<CourseRosterRow[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase.rpc("students_info", {
    p_ids: ids,
  });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Omit<CourseRosterRow, "program_name" | "subject_name">[]).map(
    (r) => ({ ...r, program_name: null, subject_name: null }),
  );
}

export interface AttendanceEntry {
  session_id: string;
  session_date: string;
  type: TutoringSessionType;
  student_id: string;
  present: boolean;
}

/** Toda la asistencia (todas las sesiones) de un curso, para exportar. */
export async function fetchAllAttendance(
  courseId: string,
): Promise<AttendanceEntry[]> {
  const { data, error } = await supabase
    .from("tutoring_attendance")
    .select(
      "student_id, present, tutoring_sessions!inner(id, session_date, type, course_id)",
    )
    .eq("tutoring_sessions.course_id", courseId);
  if (error) throw error;
  return (data ?? []).map((row) => {
    const r = row as unknown as {
      student_id: string;
      present: boolean;
      tutoring_sessions: { id: string; session_date: string; type: TutoringSessionType };
    };
    return {
      session_id: r.tutoring_sessions.id,
      session_date: r.tutoring_sessions.session_date,
      type: r.tutoring_sessions.type,
      student_id: r.student_id,
      present: r.present,
    };
  });
}

export async function updateProfessorName(
  courseId: string,
  name: string,
): Promise<void> {
  const { error } = await supabase
    .from("courses")
    .update({ professor_name: name.trim() || null })
    .eq("id", courseId);
  if (error) throw error;
}

/** Fija el horario a mano (sin depender de la votación) — para cuando
 * nadie vota o el tutor prefiere decidirlo directamente. Si luego entran
 * votos nuevos, el trigger de recompute_schedule lo vuelve a calcular
 * según la votación, como siempre. */
export async function setScheduleManually(
  courseId: string,
  schedule: string,
): Promise<void> {
  const { error } = await supabase
    .from("courses")
    .update({ schedule: schedule.trim() || null })
    .eq("id", courseId);
  if (error) throw error;
}
