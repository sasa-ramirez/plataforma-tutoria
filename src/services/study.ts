import { supabase } from "@/lib/supabase";
import { extractDocument, prepareChunks, detectKind } from "@/lib/studyText";
import { extractiveNotes, type NoteDraft } from "@/lib/studyExtractive";

export interface StudySpace {
  id: string;
  student_id: string;
  title: string;
  created_at: string;
  /** Cantidad de documentos (conteo agregado al listar). */
  doc_count?: number;
}

export interface StudyDocument {
  id: string;
  space_id: string;
  file_name: string;
  kind: "pdf" | "pptx";
  page_count: number;
  char_count: number;
  truncated: boolean;
  status: "processing" | "ready" | "error";
  error: string | null;
  created_at: string;
}

export interface StudyNote {
  id: string;
  document_id: string;
  space_id: string;
  topic: string;
  summary: string;
  key_points: string[];
  position: number;
}

export async function fetchStudySpaces(): Promise<StudySpace[]> {
  const { data, error } = await supabase
    .from("study_spaces")
    .select("*, study_documents(count)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => {
    const r = row as unknown as StudySpace & { study_documents: { count: number }[] };
    return { ...r, doc_count: r.study_documents?.[0]?.count ?? 0 };
  });
}

export async function fetchStudySpace(id: string): Promise<StudySpace | null> {
  const { data, error } = await supabase.from("study_spaces").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as StudySpace) ?? null;
}

export async function createStudySpace(title: string): Promise<StudySpace> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) throw new Error("No autenticado");
  const { data, error } = await supabase
    .from("study_spaces")
    .insert({ student_id: uid, title: title.trim() })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as StudySpace;
}

export async function deleteStudySpace(id: string): Promise<void> {
  const { error } = await supabase.from("study_spaces").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function fetchStudyDocuments(spaceId: string): Promise<StudyDocument[]> {
  const { data, error } = await supabase
    .from("study_documents")
    .select("*")
    .eq("space_id", spaceId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as StudyDocument[];
}

export async function deleteStudyDocument(id: string): Promise<void> {
  const { error } = await supabase.from("study_documents").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function fetchStudyNotes(spaceId: string): Promise<StudyNote[]> {
  const { data, error } = await supabase
    .from("study_notes")
    .select("*")
    .eq("space_id", spaceId)
    .order("document_id", { ascending: true })
    .order("position", { ascending: true });
  if (error) throw error;
  return (data ?? []) as StudyNote[];
}

/** El mensaje real de la función (p. ej. "Alcanzaste el límite diario…"):
 * supabase-js solo dice "non-2xx" y deja la respuesta en error.context.
 * Si la respuesta no trae nuestro formato (caída de la función, tiempo
 * agotado), se muestra el código HTTP y lo que haya, para poder diagnosticar. */
async function functionError(error: unknown): Promise<string> {
  const ctx = (error as { context?: Response })?.context;
  if (ctx && typeof ctx.text === "function") {
    const status = ctx.status;
    try {
      const raw = await ctx.text();
      try {
        const body = JSON.parse(raw);
        if (body?.error) return String(body.error);
        if (body?.message) return `${body.message} (HTTP ${status})`;
      } catch {
        /* no era JSON */
      }
      if (raw.trim()) return `${raw.trim().slice(0, 160)} (HTTP ${status})`;
    } catch {
      /* se usa el mensaje genérico */
    }
    return `La función no respondió bien (HTTP ${status}). Intenta de nuevo.`;
  }
  return error instanceof Error ? error.message : "Error desconocido";
}

export type ProcessPhase = "reading" | "summarizing" | "saving";
export interface ProcessProgress {
  phase: ProcessPhase;
  done: number;
  total: number;
}

/** Límite por minuto: se espera un poco y se vuelve a intentar. */
const RATE_LIMITED = /vas muy rápido/i;
/** Límite diario: la IA no sirve más por hoy, no tiene sentido seguir llamándola. */
const DAILY_LIMIT = /límite diario/i;
/** Fragmentos que se resumen a la vez. Más de 4 choca con el límite por minuto. */
const CONCURRENCY = 4;
/** Tiempo máximo que se espera a la IA por fragmento (la función se corta sola a ~110 s). */
const CHUNK_TIMEOUT_MS = 75_000;

// Corta-circuito: si la IA falló en un documento completo, los siguientes se
// arman directo del texto (al instante) durante unos minutos en vez de hacer
// esperar al estudiante otra vez por algo que probablemente sigue caído.
const AI_DOWN_KEY = "kodea.study.aiDownUntil";
const AI_DOWN_MS = 10 * 60_000;
function aiIsDown(): boolean {
  try {
    return Number(sessionStorage.getItem(AI_DOWN_KEY)) > Date.now();
  } catch {
    return false;
  }
}
function setAiDown(down: boolean) {
  try {
    if (down) sessionStorage.setItem(AI_DOWN_KEY, String(Date.now() + AI_DOWN_MS));
    else sessionStorage.removeItem(AI_DOWN_KEY);
  } catch {
    /* sin sessionStorage: solo se pierde el corta-circuito */
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const withTimeout = <T>(p: Promise<T>, ms: number) =>
  Promise.race([p, new Promise<never>((_, rej) => setTimeout(() => rej(new Error("tiempo agotado")), ms))]);

/** Resume un fragmento con la IA. Si falla, devuelve el motivo (el llamador usa el respaldo). */
async function summarizeChunk(
  body: Record<string, unknown>,
): Promise<{ notes: NoteDraft[] } | { error: string; daily: boolean }> {
  let lastError = "";
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const { data, error } = await withTimeout(
        supabase.functions.invoke("ai-study-summarize", { body }),
        CHUNK_TIMEOUT_MS,
      );
      if (!error && data?.ok) return { notes: (data.notes ?? []) as NoteDraft[] };
      lastError = error ? await functionError(error) : String(data?.error ?? "La IA no respondió");
    } catch (e) {
      lastError = e instanceof Error ? e.message : "La IA no respondió";
    }
    if (DAILY_LIMIT.test(lastError)) return { error: lastError, daily: true };
    if (RATE_LIMITED.test(lastError) && attempt < 3) {
      await sleep(8000);
      continue;
    }
    break; // la función ya probó varios modos y modelos por dentro: reintentar igual no ayuda
  }
  return { error: lastError, daily: false };
}

/**
 * Sube un documento: extrae el texto en el navegador y arma las notas por tema.
 * Cada fragmento intenta primero la IA (4 a la vez); si la IA falla, se tarda
 * o no devuelve nada útil, esa parte se arma directamente del texto, sin IA.
 * Así un documento con texto SIEMPRE queda listo. El archivo original NO se guarda.
 */
export async function processStudyDocument(input: {
  space: StudySpace;
  file: File;
  onProgress?: (p: ProcessProgress) => void;
}): Promise<StudyDocument> {
  const { space, file, onProgress } = input;
  const kind = detectKind(file);
  if (!kind) throw new Error("Solo se aceptan archivos PDF o PowerPoint (.pptx).");

  // getSession lee la sesión local (sin viaje a la red, a diferencia de getUser).
  const { data: sess } = await supabase.auth.getSession();
  const uid = sess.session?.user.id;
  if (!uid) throw new Error("No autenticado");

  // Lectura del archivo y comprobación de duplicado, a la vez.
  onProgress?.({ phase: "reading", done: 0, total: 1 });
  const [dupRes, extracted] = await Promise.all([
    supabase.from("study_documents").select("id").eq("space_id", space.id).eq("file_name", file.name).limit(1),
    extractDocument(file, (done, total) => onProgress?.({ phase: "reading", done, total })),
  ]);
  if (dupRes.data && dupRes.data.length > 0) {
    throw new Error("Ya subiste un archivo con ese nombre en esta materia.");
  }
  const prepared = prepareChunks(extracted);

  const { data: doc, error: docErr } = await supabase
    .from("study_documents")
    .insert({
      space_id: space.id,
      student_id: uid,
      file_name: file.name,
      kind,
      page_count: prepared.pageCount,
      char_count: prepared.charCount,
      truncated: prepared.truncated,
      status: "processing",
    })
    .select("*")
    .single();
  if (docErr) throw new Error(docErr.message);
  const document = doc as StudyDocument;

  const total = prepared.chunks.length;
  // Tamaño de los temas de respaldo: crece con el documento para no pasar del tope de notas.
  const groupChars = Math.max(1100, Math.ceil(prepared.charCount / 55));
  let aiDisabled = aiIsDown();
  let aiOk = 0;
  let aiFailed = 0;
  let fallbackChunks = 0;
  let noteCount = 0;
  let finished = 0;
  let next = 0;
  let saveError = "";
  onProgress?.({ phase: "summarizing", done: 0, total });

  const saveNotes = async (chunkIndex: number, notes: NoteDraft[]) => {
    if (notes.length === 0) return;
    noteCount += notes.length;
    // position fijo (índice*100 + n): el orden del documento se conserva aunque terminen desordenados.
    const { error } = await supabase.from("study_notes").insert(
      notes.map((n, k) => ({
        document_id: document.id,
        space_id: space.id,
        student_id: uid,
        topic: n.topic,
        summary: n.summary,
        key_points: n.key_points,
        position: chunkIndex * 100 + k,
      })),
    );
    if (error) saveError = error.message;
  };

  const worker = async () => {
    for (;;) {
      const i = next++;
      if (i >= total) return;
      const chunk = prepared.chunks[i];

      let notes: NoteDraft[] | null = null;
      if (!aiDisabled) {
        const res = await summarizeChunk({
          fileName: file.name,
          spaceTitle: space.title,
          label: chunk.label,
          text: chunk.text,
          index: i,
          total,
        });
        if ("notes" in res) {
          notes = res.notes;
          aiOk++;
        } else {
          aiFailed++;
          // Un límite diario, o dos fallos sin ningún éxito: la IA no está sirviendo.
          if (res.daily || (aiOk === 0 && aiFailed >= 2)) aiDisabled = true;
        }
      }
      if (notes === null) {
        fallbackChunks++;
        notes = extractiveNotes(prepared.pages.slice(chunk.from - 1, chunk.to), chunk.from, prepared.unit, groupChars);
      }
      await saveNotes(i, notes);
      finished++;
      onProgress?.({ phase: "summarizing", done: finished, total });
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, total) }, worker));

  // Se recuerda si la IA está sirviendo (para no hacer esperar de nuevo si está caída).
  if (aiOk > 0) setAiDown(false);
  else if (aiFailed > 0) setAiDown(true);

  // Estado final: solo es error si de verdad no hay nada que estudiar.
  let status: StudyDocument["status"] = "ready";
  let error: string | null = null;
  if (noteCount === 0) {
    status = "error";
    error =
      saveError ||
      "No encontré contenido de estudio en este archivo (¿es una plantilla, una portada o solo imágenes?). Prueba con tus diapositivas o apuntes reales.";
  } else if (fallbackChunks === total) {
    error =
      "Las notas se armaron directamente del texto del archivo porque la IA no respondió. Sirven igual para tus parciales.";
  } else if (fallbackChunks > 0) {
    error = `${fallbackChunks} de ${total} partes se armaron directamente del texto porque la IA no respondió. Sirven igual para tus parciales.`;
  }
  const { data: done, error: updErr } = await supabase
    .from("study_documents")
    .update({ status, error })
    .eq("id", document.id)
    .select("*")
    .single();
  if (updErr) throw new Error(updErr.message);
  return done as StudyDocument;
}

// ---------- Parcial simulado ----------

export type ExamDifficulty = "mixed" | "easy" | "medium" | "hard";

export interface StudyExam {
  id: string;
  space_id: string;
  title: string;
  difficulty: ExamDifficulty;
  question_count: number;
  status: "in_progress" | "finished";
  correct_count: number | null;
  created_at: string;
  finished_at: string | null;
}

export interface StudyExamQuestion {
  id: string;
  exam_id: string;
  position: number;
  topic: string;
  question: string;
  options: string[];
  correct: number;
  explanation: string | null;
  selected: number | null;
}

export async function fetchStudyExams(spaceId: string): Promise<StudyExam[]> {
  const { data, error } = await supabase
    .from("study_exams")
    .select("*")
    .eq("space_id", spaceId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as StudyExam[];
}

export async function fetchStudyExam(
  examId: string,
): Promise<{ exam: StudyExam; questions: StudyExamQuestion[] } | null> {
  const { data: exam, error } = await supabase.from("study_exams").select("*").eq("id", examId).maybeSingle();
  if (error) throw error;
  if (!exam) return null;
  const { data: questions, error: qErr } = await supabase
    .from("study_exam_questions")
    .select("*")
    .eq("exam_id", examId)
    .order("position", { ascending: true });
  if (qErr) throw qErr;
  return { exam: exam as StudyExam, questions: (questions ?? []) as StudyExamQuestion[] };
}

/** Pide a la IA un parcial con las notas de la materia. Devuelve el id del parcial. */
export async function createStudyExam(input: {
  spaceId: string;
  count: number;
  difficulty: ExamDifficulty;
  /** Solo evaluar estos temas (parcial de refuerzo). */
  focus?: string[];
}): Promise<string> {
  const { data, error } = await supabase.functions.invoke("ai-study-exam", { body: input });
  if (error) throw new Error(await functionError(error));
  if (!data?.ok) throw new Error(data?.error ?? "La IA no pudo armar el parcial");
  return data.examId as string;
}

export async function answerExamQuestion(questionId: string, selected: number): Promise<void> {
  const { error } = await supabase.from("study_exam_questions").update({ selected }).eq("id", questionId);
  if (error) throw new Error(error.message);
}

/** Finaliza el parcial; el servidor calcula el puntaje. Devuelve las acertadas. */
export async function finishStudyExam(examId: string): Promise<number> {
  const { data, error } = await supabase.rpc("study_exam_finish", { p_exam: examId });
  if (error) throw new Error(error.message);
  return (data as number) ?? 0;
}

export async function deleteStudyExam(examId: string): Promise<void> {
  const { error } = await supabase.from("study_exams").delete().eq("id", examId);
  if (error) throw new Error(error.message);
}

/** Parciales finalizados de la materia y todas sus preguntas, para el informe de falencias. */
export async function fetchStudyReportData(
  spaceId: string,
): Promise<{ exams: StudyExam[]; questions: StudyExamQuestion[] }> {
  const { data: exams, error } = await supabase
    .from("study_exams")
    .select("*")
    .eq("space_id", spaceId)
    .eq("status", "finished")
    .order("created_at", { ascending: true });
  if (error) throw error;
  const list = (exams ?? []) as StudyExam[];
  if (list.length === 0) return { exams: [], questions: [] };

  // Hasta 60 parciales x 30 preguntas: se pagina porque la consulta devuelve 1000 como máximo.
  const ids = list.map((e) => e.id);
  const questions: StudyExamQuestion[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error: qErr } = await supabase
      .from("study_exam_questions")
      .select("*")
      .in("exam_id", ids)
      .order("exam_id", { ascending: true })
      .order("position", { ascending: true })
      .range(from, from + 999);
    if (qErr) throw qErr;
    questions.push(...((data ?? []) as StudyExamQuestion[]));
    if (!data || data.length < 1000) break;
  }
  return { exams: list, questions };
}
