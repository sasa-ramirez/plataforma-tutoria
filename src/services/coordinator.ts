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
