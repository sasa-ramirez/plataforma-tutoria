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

export type PriorityGroup =
  | "indigena"
  | "afro"
  | "discapacidad"
  | "victima"
  | "lgbtiq"
  | "frontera";

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
  national_id: string | null;
  student_code: string | null;
  sex: "F" | "M" | null;
  priority_group: PriorityGroup | null;
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
  professor_name: string | null;
  created_at: string;
}

export type TutoringSessionType = "planificada" | "ocasional";

export interface PeriodicReport {
  id: string;
  course_id: string;
  tutor_id: string;
  tutor_name: string | null;
  report_date: string;
  place: string;
  group_label: string | null;
  participants_count: number | null;
  program_name: string | null;
  subject_name: string | null;
  semester: string | null;
  professor_name: string | null;
  topics: string | null;
  description: string;
  observations: string | null;
  photo_path: string | null;
  created_at: string;
}

export interface Acta {
  id: string;
  course_id: string;
  tutor_id: string;
  tutor_name: string | null;
  acta_number: string | null;
  acta_date: string;
  organismo: string;
  asunto: string | null;
  program_name: string | null;
  professor_name: string | null;
  orden_dia: string | null;
  desarrollo: string;
  conclusiones: string | null;
  compromisos: string | null;
  observaciones: string | null;
  created_at: string;
}

export interface TutoringSession {
  id: string;
  course_id: string;
  tutor_id: string;
  session_date: string;
  type: TutoringSessionType;
  topic: string | null;
  created_at: string;
}

export interface CourseRosterRow {
  student_id: string;
  full_name: string | null;
  email: string;
  national_id: string | null;
  student_code: string | null;
  sex: "F" | "M" | null;
  priority_group: PriorityGroup | null;
  program_name: string | null;
  subject_name: string | null;
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
  /** Lote de IA (migración 0036): preguntas generadas juntas comparten id y tema. */
  quiz_batch_id: string | null;
  quiz_batch_topic: string | null;
}

export type QuizMode = "sync" | "pace";
export type QuizStatus = "lobby" | "active" | "ended";

export interface QuizSession {
  id: string;
  assignment_id: string;
  course_id: string;
  mode: QuizMode;
  status: QuizStatus;
  current_index: number;
  /** Orden de preguntas al azar por estudiante, elegido al iniciar (migración 0036). */
  shuffle: boolean;
  /** Incidencias que anota el profesor (migración 0037). */
  notes?: string | null;
  /** "Tarea abierta": arranca sola y cada estudiante la hace cuando quiera (migración 0041). */
  is_open?: boolean;
  /** Hora de cierre automática de una tarea abierta (null = la cierra el tutor). */
  closes_at?: string | null;
  started_at: string | null;
  ended_at: string | null;
  created_by: string | null;
  created_at: string;
}

export interface QuizParticipant {
  id: string;
  session_id: string;
  student_id: string;
  score: number;
  current_index: number;
  /** Su propio orden de preguntas cuando la sesión es shuffle (migración 0036). */
  question_order: string[] | null;
  joined_at: string;
  full_name?: string | null;
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
  /** Nota manual del tutor (migración 0031): si existe, `score` es la del tutor. */
  teacher_comment?: string | null;
  teacher_graded_at?: string | null;
  teacher_graded_by?: string | null;
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
