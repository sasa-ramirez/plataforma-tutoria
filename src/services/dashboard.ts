import { supabase } from "@/lib/supabase";
import { fetchStudentCourses, fetchTeacherCourses } from "@/services/courses";
import type { Assignment, Course } from "@/types/database";

// ----------------- ESTUDIANTE -----------------
export interface StudentStats {
  graded: number;
  pending: number;
  courses: Course[];
  pendingTasks: Pick<
    Assignment,
    "id" | "title" | "course_id" | "difficulty" | "closes_at" | "status" | "opens_at"
  >[];
  courseTitles: Record<string, string>;
}

export async function fetchStudentStats(
  studentId: string,
): Promise<StudentStats> {
  const courses = await fetchStudentCourses();
  const courseIds = courses.map((c) => c.id);
  const courseTitles = Object.fromEntries(courses.map((c) => [c.id, c.title]));

  const [{ count: graded }, pendingRes] = await Promise.all([
    supabase
      .from("submissions")
      .select("id", { count: "exact", head: true })
      .eq("student_id", studentId)
      .eq("status", "graded"),
    courseIds.length
      ? supabase
          .from("assignments")
          .select("id, title, course_id, difficulty, closes_at, status, opens_at")
          .in("course_id", courseIds)
          .eq("status", "open")
          .is("deleted_at", null)
          .order("closes_at", { ascending: true })
      : Promise.resolve({ data: [] as StudentStats["pendingTasks"] }),
  ]);

  const pendingTasks = (pendingRes.data ?? []) as StudentStats["pendingTasks"];
  return {
    graded: graded ?? 0,
    pending: pendingTasks.length,
    courses,
    pendingTasks,
    courseTitles,
  };
}

// ----------------- PROFESOR -----------------
export interface RecentActivity {
  id: string;
  studentName: string | null;
  exerciseTitle: string | null;
  status: string;
  score: number | null;
  created_at: string;
}

export interface TeacherStats {
  students: number;
  courses: number;
  toGrade: number;
  submissions: number;
  recent: RecentActivity[];
}

export async function fetchTeacherStats(
  teacherId: string,
): Promise<TeacherStats> {
  const courses = await fetchTeacherCourses(teacherId);
  const students = courses.reduce((s, c) => s + (c.student_count ?? 0), 0);

  const [toGradeRes, totalRes, recentRes] = await Promise.all([
    supabase
      .from("submissions")
      .select("id", { count: "exact", head: true })
      .eq("status", "submitted"),
    supabase.from("submissions").select("id", { count: "exact", head: true }),
    supabase
      .from("submissions")
      .select(
        "id, status, score, created_at, profiles(full_name), exercises(title)",
      )
      .neq("status", "draft")
      .order("created_at", { ascending: false })
      .limit(6),
  ]);

  const recent: RecentActivity[] = (recentRes.data ?? []).map((r) => {
    const row = r as unknown as {
      id: string;
      status: string;
      score: number | null;
      created_at: string;
      profiles: { full_name: string | null } | null;
      exercises: { title: string | null } | null;
    };
    return {
      id: row.id,
      studentName: row.profiles?.full_name ?? null,
      exerciseTitle: row.exercises?.title ?? null,
      status: row.status,
      score: row.score,
      created_at: row.created_at,
    };
  });

  return {
    students,
    courses: courses.length,
    toGrade: toGradeRes.count ?? 0,
    submissions: totalRes.count ?? 0,
    recent,
  };
}
