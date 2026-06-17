// Tipos de dominio alineados con supabase/migrations/0001_init.sql
// (Para un proyecto productivo puedes regenerarlos con `supabase gen types`.)

export type UserRole = "student" | "teacher";
export type Difficulty = "beginner" | "easy" | "medium" | "hard";
export type ProgLanguage = "pseint" | "java" | "python" | "logic";
export type AssignmentStatus = "draft" | "open" | "closed";
export type SubmissionStatus =
  | "draft"
  | "submitted"
  | "grading"
  | "graded"
  | "error";
export type ExamEvent =
  | "tab_blur"
  | "tab_focus"
  | "window_hidden"
  | "window_visible"
  | "paste"
  | "copy"
  | "fullscreen_exit";

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: UserRole;
  is_admin: boolean;
  is_coordinator: boolean;
  streak: number;
  xp: number;
  last_active: string | null;
  created_at: string;
  updated_at: string;
}

export type TeacherRequestStatus = "pending" | "approved" | "rejected";

export interface TeacherRequest {
  id: string;
  user_id: string;
  status: TeacherRequestStatus;
  note: string | null;
  reviewed_by: string | null;
  created_at: string;
  reviewed_at: string | null;
}

export interface Course {
  id: string;
  teacher_id: string;
  title: string;
  description: string | null;
  color: string;
  join_code: string;
  subject_id: string | null;
  schedule: string | null;
  created_at: string;
}

// ---- Catálogo académico: Facultad → Carrera → Asignatura ----
export interface Faculty {
  id: string;
  name: string;
  created_at: string;
}
export interface Career {
  id: string;
  faculty_id: string;
  name: string;
  created_at: string;
}
export interface Subject {
  id: string;
  career_id: string;
  name: string;
  created_at: string;
}

export interface Enrollment {
  id: string;
  course_id: string;
  student_id: string;
  created_at: string;
}

export interface Assignment {
  id: string;
  course_id: string;
  title: string;
  description: string | null;
  instructions: string | null;
  difficulty: Difficulty;
  language: ProgLanguage;
  points: number;
  status: AssignmentStatus;
  is_exam: boolean;
  time_limit_min: number | null;
  opens_at: string | null;
  closes_at: string | null;
  created_at: string;
}

export type ExerciseType = "code" | "multiple_choice" | "numeric" | "open";

export interface Exercise {
  id: string;
  assignment_id: string | null;
  is_practice: boolean;
  title: string;
  prompt: string;
  starter_code: string;
  solution_code: string | null;
  language: ProgLanguage;
  difficulty: Difficulty;
  points: number;
  order_index: number;
  type: ExerciseType;
  options: string[]; // opciones (selección múltiple)
  created_by: string | null;
  created_at: string;
}

export interface Submission {
  id: string;
  exercise_id: string;
  student_id: string;
  code: string;
  language: ProgLanguage;
  status: SubmissionStatus;
  score: number | null;
  attempt: number;
  answer: Record<string, unknown> | null;
  started_at: string | null;
  submitted_at: string | null;
  created_at: string;
}

export interface AIError {
  line?: number;
  message: string;
  severity: "info" | "warning" | "error";
}

export interface AIFeedback {
  id: string;
  submission_id: string;
  score: number;
  summary: string | null;
  errors: AIError[];
  suggestions: string[];
  strengths: string[];
  model: string | null;
  created_at: string;
}

export interface ExamLog {
  id: string;
  submission_id: string;
  student_id: string;
  event_type: ExamEvent;
  meta: Record<string, unknown>;
  created_at: string;
}

export interface PracticeSession {
  id: string;
  student_id: string;
  exercise_id: string;
  attempts: number;
  best_score: number | null;
  completed: boolean;
  last_code: string;
  created_at: string;
  updated_at: string;
}
