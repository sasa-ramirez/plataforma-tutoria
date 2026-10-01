import { supabase } from "@/lib/supabase";
import type {
  Assignment,
  AssignmentStatus,
  Difficulty,
  Exercise,
  ExerciseType,
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
  type?: ExerciseType;
  options?: string[];
  // Clave de respuesta privada (correcta/tolerancia). Va a exercise_answers.
  answer_key?: Record<string, unknown>;
  // Lote de IA (migración 0036): agrupa visualmente preguntas generadas juntas.
  quiz_batch_id?: string | null;
  quiz_batch_topic?: string | null;
}

export async function createExercise(
  input: CreateExerciseInput,
): Promise<Exercise> {
  const { data: userData } = await supabase.auth.getUser();
  const { answer_key, options, type, ...rest } = input;
  // Para 'code' (o legado) no enviamos type/options: así crear ejercicios de
  // código sigue funcionando aunque la migración 0012 no esté aplicada.
  const isNonCode = !!type && type !== "code";
  const payload = isNonCode
    ? { ...rest, type, options: options ?? [], created_by: userData.user?.id }
    : { ...rest, created_by: userData.user?.id };
  const { data, error } = await supabase
    .from("exercises")
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  const exercise = data as Exercise;

  // Guarda la clave de respuesta privada (selección/numérica) aparte.
  if (answer_key && Object.keys(answer_key).length > 0) {
    const { error: keyErr } = await supabase
      .from("exercise_answers")
      .upsert({ exercise_id: exercise.id, key: answer_key });
    if (keyErr) throw keyErr;
  }
  return exercise;
}

export interface GenerateQuizInput {
  assignmentId: string;
  language: ProgLanguage;
  topic: string;
  count: number;
  difficulty: Difficulty;
  subjectHint?: string | null;
}

/**
 * Le pide a la IA un lote de preguntas de opción múltiple (tema + cuántas +
 * dificultad) y las crea todas de una vez bajo la tarea, listas para usar
 * en un quiz — en vez de crear cada pregunta a mano una por una. Reutiliza
 * `createExercise` para cada una, así que queda igual de blindado por RLS.
 * Devuelve cuántas preguntas se crearon de verdad.
 */
export async function generateQuizExercises(
  input: GenerateQuizInput,
): Promise<number> {
  const { data, error } = await supabase.functions.invoke("ai-generate-quiz", {
    body: {
      topic: input.topic,
      count: input.count,
      difficulty: input.difficulty,
      subjectHint: input.subjectHint || undefined,
    },
  });
  if (error) throw new Error(error.message);
  if (!data?.ok) throw new Error(data?.error ?? "La IA no pudo generar las preguntas");

  const questions = (data.questions ?? []) as {
    title: string;
    prompt: string;
    options: string[];
    correct: number;
  }[];
  if (questions.length === 0) throw new Error("La IA no devolvió preguntas.");

  const existing = await fetchExercisesByAssignment(input.assignmentId);
  let nextIndex = existing.length + 1;

  // Mismo id para las N preguntas de este lote: así la lista de ejercicios
  // las puede agrupar visualmente bajo una sola tarjeta plegable.
  const batchId = crypto.randomUUID();

  for (const q of questions) {
    await createExercise({
      assignment_id: input.assignmentId,
      title: q.title,
      prompt: q.prompt,
      language: input.language,
      difficulty: input.difficulty,
      points: 100,
      order_index: nextIndex++,
      type: "multiple_choice",
      options: q.options,
      answer_key: { correct: String(q.correct) },
      quiz_batch_id: batchId,
      quiz_batch_topic: input.topic,
    });
  }
  return questions.length;
}

export interface GradeResult {
  score: number;
  correct: boolean;
  submission_id: string;
}

/** Envía y califica una respuesta no-código (selección/numérica) de forma segura. */
export async function submitAnswer(
  exerciseId: string,
  answer: Record<string, unknown>,
): Promise<GradeResult> {
  const { data, error } = await supabase.rpc("submit_answer", {
    p_exercise_id: exerciseId,
    p_answer: answer,
  });
  if (error) throw new Error(error.message);
  return data as GradeResult;
}
