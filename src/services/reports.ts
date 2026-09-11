import { supabase } from "@/lib/supabase";
import type { PeriodicReport } from "@/types/database";

const BUCKET = "report-photos";

export async function fetchReports(courseId: string): Promise<PeriodicReport[]> {
  const { data, error } = await supabase
    .from("periodic_reports")
    .select("*")
    .eq("course_id", courseId)
    .order("report_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as PeriodicReport[];
}

export async function fetchReport(reportId: string): Promise<PeriodicReport> {
  const { data, error } = await supabase
    .from("periodic_reports")
    .select("*")
    .eq("id", reportId)
    .single();
  if (error) throw error;
  return data as PeriodicReport;
}

/** URL firmada (el bucket es privado) para mostrar/imprimir la foto. */
export async function fetchReportPhotoUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 60 * 60); // 1 hora, alcanza para ver/imprimir
  if (error) throw error;
  return data.signedUrl;
}

export interface CreateReportInput {
  courseId: string;
  tutorName: string;
  reportDate: string;
  place: string;
  groupLabel: string;
  participantsCount: number | null;
  programName: string | null;
  subjectName: string | null;
  semester: string;
  professorName: string | null;
  topics: string;
  description: string;
  observations: string;
  photo: File | null;
}

export async function createReport(input: CreateReportInput): Promise<PeriodicReport> {
  const { data: userData } = await supabase.auth.getUser();
  const tutorId = userData.user?.id;
  if (!tutorId) throw new Error("Sesión no válida.");

  let photoPath: string | null = null;
  if (input.photo) {
    const ext = input.photo.name.split(".").pop() || "jpg";
    photoPath = `${input.courseId}/${crypto.randomUUID()}.${ext}`;
    const { error: uploadErr } = await supabase.storage
      .from(BUCKET)
      .upload(photoPath, input.photo, { contentType: input.photo.type });
    if (uploadErr) throw uploadErr;
  }

  const { data, error } = await supabase
    .from("periodic_reports")
    .insert({
      course_id: input.courseId,
      tutor_id: tutorId,
      tutor_name: input.tutorName,
      report_date: input.reportDate,
      place: input.place.trim() || "Bienestar Social Universitario",
      group_label: input.groupLabel.trim() || null,
      participants_count: input.participantsCount,
      program_name: input.programName,
      subject_name: input.subjectName,
      semester: input.semester.trim() || null,
      professor_name: input.professorName,
      topics: input.topics.trim() || null,
      description: input.description.trim(),
      observations: input.observations.trim() || null,
      photo_path: photoPath,
    })
    .select()
    .single();
  if (error) throw error;
  return data as PeriodicReport;
}

export async function deleteReport(report: PeriodicReport): Promise<void> {
  if (report.photo_path) {
    await supabase.storage.from(BUCKET).remove([report.photo_path]);
  }
  const { error } = await supabase.from("periodic_reports").delete().eq("id", report.id);
  if (error) throw error;
}
