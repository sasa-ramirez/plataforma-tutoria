import { supabase } from "@/lib/supabase";
import type { Acta } from "@/types/database";

export async function fetchActas(courseId: string): Promise<Acta[]> {
  const { data, error } = await supabase
    .from("actas")
    .select("*")
    .eq("course_id", courseId)
    .order("acta_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Acta[];
}

export interface CreateActaInput {
  courseId: string;
  tutorName: string;
  actaNumber: string;
  actaDate: string;
  organismo: string;
  asunto: string;
  programName: string | null;
  professorName: string | null;
  ordenDia: string;
  desarrollo: string;
  conclusiones: string;
  compromisos: string;
  observaciones: string;
}

export async function createActa(input: CreateActaInput): Promise<Acta> {
  const { data: userData } = await supabase.auth.getUser();
  const tutorId = userData.user?.id;
  if (!tutorId) throw new Error("Sesión no válida.");

  const { data, error } = await supabase
    .from("actas")
    .insert({
      course_id: input.courseId,
      tutor_id: tutorId,
      tutor_name: input.tutorName,
      acta_number: input.actaNumber.trim() || null,
      acta_date: input.actaDate,
      organismo: input.organismo.trim() || "Permanencia y Graduación Exitosa",
      asunto: input.asunto.trim() || null,
      program_name: input.programName,
      professor_name: input.professorName,
      orden_dia: input.ordenDia.trim() || null,
      desarrollo: input.desarrollo.trim(),
      conclusiones: input.conclusiones.trim() || null,
      compromisos: input.compromisos.trim() || null,
      observaciones: input.observaciones.trim() || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as Acta;
}

export async function deleteActa(id: string): Promise<void> {
  const { error } = await supabase.from("actas").delete().eq("id", id);
  if (error) throw error;
}
