import { supabase } from "@/lib/supabase";
import { extractDocument, prepareChunks, detectKind } from "@/lib/studyText";

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
 * supabase-js solo dice "non-2xx" y deja la respuesta en error.context. */
async function functionError(error: unknown): Promise<string> {
  const ctx = (error as { context?: Response })?.context;
  if (ctx && typeof ctx.json === "function") {
    try {
      const body = await ctx.json();
      if (body?.error) return String(body.error);
    } catch {
      /* se usa el mensaje genérico */
    }
  }
  return error instanceof Error ? error.message : "Error desconocido";
}

export type ProcessPhase = "reading" | "summarizing" | "saving";
export interface ProcessProgress {
  phase: ProcessPhase;
  done: number;
  total: number;
}

/** Errores que no mejoran reintentando (límites o texto inservible). */
const NO_RETRY = /(límite|vas muy rápido|casi no tiene texto|No autenticado)/i;

/**
 * Sube un documento: extrae el texto en el navegador, lo manda a la IA por
 * fragmentos y guarda las notas por tema. El archivo original NO se guarda.
 */
export async function processStudyDocument(input: {
  space: StudySpace;
  file: File;
  onProgress?: (p: ProcessProgress) => void;
}): Promise<StudyDocument> {
  const { space, file, onProgress } = input;
  const kind = detectKind(file);
  if (!kind) throw new Error("Solo se aceptan archivos PDF o PowerPoint (.pptx).");

  const { data: dup } = await supabase
    .from("study_documents")
    .select("id")
    .eq("space_id", space.id)
    .eq("file_name", file.name)
    .limit(1);
  if (dup && dup.length > 0) throw new Error("Ya subiste un archivo con ese nombre en esta materia.");

  // 1) Leer el archivo (todo en el navegador)
  onProgress?.({ phase: "reading", done: 0, total: 1 });
  const extracted = await extractDocument(file, (done, total) =>
    onProgress?.({ phase: "reading", done, total }),
  );
  const prepared = prepareChunks(extracted);

  // 2) Registrar el documento
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) throw new Error("No autenticado");
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

  // 3) Resumir fragmento por fragmento, guardando las notas a medida que llegan
  const total = prepared.chunks.length;
  let position = 0;
  let okChunks = 0;
  let lastError = "";
  onProgress?.({ phase: "summarizing", done: 0, total });

  for (let i = 0; i < total; i++) {
    const chunk = prepared.chunks[i];
    let notes: { topic: string; summary: string; key_points: string[] }[] | null = null;

    for (let attempt = 1; attempt <= 2 && !notes; attempt++) {
      const { data, error } = await supabase.functions.invoke("ai-study-summarize", {
        body: {
          fileName: file.name,
          spaceTitle: space.title,
          label: chunk.label,
          text: chunk.text,
          index: i,
          total,
        },
      });
      if (error || !data?.ok) {
        lastError = error ? await functionError(error) : String(data?.error ?? "La IA no respondió");
        if (NO_RETRY.test(lastError)) break;
        continue;
      }
      notes = data.notes ?? [];
    }

    if (notes) {
      okChunks++;
      if (notes.length > 0) {
        onProgress?.({ phase: "saving", done: i, total });
        const { error } = await supabase.from("study_notes").insert(
          notes.map((n) => ({
            document_id: document.id,
            space_id: space.id,
            student_id: uid,
            topic: n.topic,
            summary: n.summary,
            key_points: n.key_points,
            position: position++,
          })),
        );
        if (error) lastError = error.message;
      }
    } else if (NO_RETRY.test(lastError)) {
      break; // un límite diario no se arregla con el siguiente fragmento
    }
    onProgress?.({ phase: "summarizing", done: i + 1, total });
  }

  // 4) Estado final
  const status = okChunks === 0 ? "error" : "ready";
  const error =
    okChunks === 0
      ? lastError || "No se pudo resumir el documento."
      : okChunks < total
        ? `Solo se resumieron ${okChunks} de ${total} partes. ${lastError}`.trim()
        : null;
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
