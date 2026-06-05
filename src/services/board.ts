import { supabase } from "@/lib/supabase";

export interface StrokeData {
  points: { x: number; y: number }[];
  color: string;
  width: number;
  mode: "pen" | "erase";
}

export interface Board {
  id: string;
  course_id: string;
  text_content: string;
  is_live: boolean;
  join_code: string;
}

// Columnas de la clase en vivo (migración 0009). Hacemos el código tolerante
// a que la columna AÚN no exista: si falta, caemos a un select base para no
// romper el tablero en producción mientras se aplica la migración.
const FULL_SELECT = "id, course_id, text_content, is_live, courses(join_code)";
const BASE_SELECT = "id, course_id, text_content, courses(join_code)";

function isMissingLiveColumn(err: { message?: string; code?: string } | null) {
  if (!err) return false;
  // PostgREST/Postgres: 42703 = undefined_column
  return err.code === "42703" || /is_live|live_started_at/.test(err.message ?? "");
}

// Aplana courses(join_code) → join_code en el objeto Board.
function toBoard(row: unknown): Board {
  const r = row as {
    id: string;
    course_id: string;
    text_content: string;
    is_live?: boolean;
    courses?: { join_code: string } | { join_code: string }[] | null;
  };
  const c = Array.isArray(r.courses) ? r.courses[0] : r.courses;
  return {
    id: r.id,
    course_id: r.course_id,
    text_content: r.text_content,
    is_live: r.is_live ?? false,
    join_code: c?.join_code ?? "",
  };
}

/** Profesor: crea el tablero si no existe. Estudiante: solo lo lee. */
export async function getOrCreateBoard(
  courseId: string,
  isTeacher: boolean,
): Promise<Board | null> {
  let { data, error } = await supabase
    .from("boards")
    .select(FULL_SELECT)
    .eq("course_id", courseId)
    .maybeSingle();
  // Fallback si la migración 0009 aún no se aplicó.
  if (error && isMissingLiveColumn(error)) {
    ({ data, error } = await supabase
      .from("boards")
      .select(BASE_SELECT)
      .eq("course_id", courseId)
      .maybeSingle());
  }
  if (data) return toBoard(data);

  if (!isTeacher) return null; // el profe aún no abrió el tablero

  const created = await supabase
    .from("boards")
    .insert({ course_id: courseId })
    .select(FULL_SELECT)
    .single();
  if (created.error && isMissingLiveColumn(created.error)) {
    // La migración 0009 no está. El insert pudo haber creado la fila aunque
    // el RETURNING fallara; releemos antes de reintentar para no chocar con
    // la restricción única de course_id.
    const reread = await supabase
      .from("boards")
      .select(BASE_SELECT)
      .eq("course_id", courseId)
      .maybeSingle();
    if (reread.data) return toBoard(reread.data);
    const retry = await supabase
      .from("boards")
      .insert({ course_id: courseId })
      .select(BASE_SELECT)
      .single();
    if (retry.error) throw retry.error;
    return toBoard(retry.data);
  }
  if (created.error) throw created.error;
  return toBoard(created.data);
}

/**
 * Profesor: enciende/apaga la transmisión en vivo (dispara aviso a inscritos).
 * Devuelve true si se guardó en BD; false si la migración 0009 aún no está
 * (en ese caso el badge EN VIVO sigue funcionando vía broadcast, pero no se
 * persiste ni se notifica hasta aplicar la migración).
 */
export async function setBoardLive(
  boardId: string,
  live: boolean,
): Promise<boolean> {
  const { error } = await supabase
    .from("boards")
    .update({
      is_live: live,
      live_started_at: live ? new Date().toISOString() : null,
    })
    .eq("id", boardId);
  if (error && isMissingLiveColumn(error)) return false;
  if (error) throw error;
  return true;
}

export async function fetchStrokes(boardId: string): Promise<StrokeData[]> {
  const { data, error } = await supabase
    .from("board_strokes")
    .select("data")
    .eq("board_id", boardId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => (r as { data: StrokeData }).data);
}

export async function saveStroke(boardId: string, stroke: StrokeData) {
  await supabase.from("board_strokes").insert({ board_id: boardId, data: stroke });
}

export async function clearStrokes(boardId: string) {
  await supabase.from("board_strokes").delete().eq("board_id", boardId);
}

export async function saveBoardText(boardId: string, text: string) {
  await supabase.from("boards").update({ text_content: text }).eq("id", boardId);
}
