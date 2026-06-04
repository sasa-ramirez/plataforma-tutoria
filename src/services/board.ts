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
}

/** Profesor: crea el tablero si no existe. Estudiante: solo lo lee. */
export async function getOrCreateBoard(
  courseId: string,
  isTeacher: boolean,
): Promise<Board | null> {
  const { data } = await supabase
    .from("boards")
    .select("id, course_id, text_content")
    .eq("course_id", courseId)
    .maybeSingle();
  if (data) return data as Board;

  if (!isTeacher) return null; // el profe aún no abrió el tablero

  const { data: created, error } = await supabase
    .from("boards")
    .insert({ course_id: courseId })
    .select("id, course_id, text_content")
    .single();
  if (error) throw error;
  return created as Board;
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
