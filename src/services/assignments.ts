import { supabase } from "@/lib/supabase";
import type {
  Assignment,
  AssignmentStatus,
  Difficulty,
  Exercise,
  ProgLanguage,
} from "@/types/database";

export async function fetchAssignments(
  courseId: string,
): Promise<Assignment[]> {
  const { data, error } = await supabase
    .from("assignments")
    .select("*")
    .eq("course_id", courseId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Assignment[];
}

export async function fetchAssignment(id: string): Promise<Assignment> {
  const { data, error } = await supabase
    .from("assignments")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .single();
  if (error) throw error;
  return data as Assignment;
}

export interface CreateAssignmentInput {
  course_id: string;
  title: string;
  description?: string;
  instructions?: string;
  difficulty: Difficulty;
  language: ProgLanguage;
  points: number;
  is_exam: boolean;
  time_limit_min?: number | null;
  opens_at?: string | null;
  closes_at?: string | null;
  status: AssignmentStatus;
}

export async function createAssignment(
  input: CreateAssignmentInput,
): Promise<Assignment> {
  const { data, error } = await supabase
    .from("assignments")
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  return data as Assignment;
}

export async function updateAssignmentStatus(
  id: string,
  status: AssignmentStatus,
): Promise<void> {
  const { error } = await supabase
    .from("assignments")
    .update({ status })
    .eq("id", id);
  if (error) throw error;
}

/** Borrado suave de una tarea (solo el profesor dueño, vía RLS). */
export async function softDeleteAssignment(id: string): Promise<void> {
  const { error } = await supabase
    .from("assignments")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

// -------- Ejercicios --------

export async function fetchExercisesByAssignment(
  assignmentId: string,
): Promise<Exercise[]> {
  const { data, error } = await supabase
    .from("exercises")
    .select("*")
    .eq("assignment_id", assignmentId)
    .is("deleted_at", null)
    .order("order_index", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Exercise[];
}

export async function fetchExercise(id: string): Promise<Exercise> {
  const { data, error } = await supabase
    .from("exercises")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data as Exercise;
}

export interface CreateExerciseInput {
  assignment_id: string;
  title: string;
  prompt: string;
  starter_code?: string;
  solution_code?: string;
  language: ProgLanguage;
  difficulty: Difficulty;
  points: number;
  order_index: number;
}

export async function createExercise(
  input: CreateExerciseInput,
): Promise<Exercise> {
  const { data: userData } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("exercises")
    .insert({ ...input, created_by: userData.user?.id })
    .select()
    .single();
  if (error) throw error;
  return data as Exercise;
}
