import { supabase } from "@/lib/supabase";

const BUCKET = "course-materials";

export interface CourseMaterial {
  id: string;
  course_id: string;
  title: string;
  description: string | null;
  kind: "file" | "link";
  storage_path: string | null;
  file_name: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  url: string | null;
  created_at: string;
}

export async function fetchMaterials(courseId: string): Promise<CourseMaterial[]> {
  const { data, error } = await supabase
    .from("course_materials")
    .select("*")
    .eq("course_id", courseId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as CourseMaterial[];
}

/** URL firmada (el bucket es privado) para abrir/descargar el archivo. */
export async function fetchMaterialFileUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, 60 * 10); // 10 minutos, alcanza para abrirlo
  if (error) throw error;
  return data.signedUrl;
}

export interface AddMaterialFileInput {
  courseId: string;
  title: string;
  description: string;
  file: File;
}

export async function addMaterialFile(input: AddMaterialFileInput): Promise<CourseMaterial> {
  const ext = input.file.name.split(".").pop() || "bin";
  const storagePath = `${input.courseId}/${crypto.randomUUID()}.${ext}`;
  const { error: uploadErr } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, input.file, { contentType: input.file.type });
  if (uploadErr) throw uploadErr;

  const { data, error } = await supabase
    .from("course_materials")
    .insert({
      course_id: input.courseId,
      title: input.title.trim(),
      description: input.description.trim() || null,
      kind: "file",
      storage_path: storagePath,
      file_name: input.file.name,
      mime_type: input.file.type,
      size_bytes: input.file.size,
    })
    .select()
    .single();
  if (error) {
    // El registro falló: no dejar el archivo huérfano en Storage.
    await supabase.storage.from(BUCKET).remove([storagePath]);
    throw error;
  }
  return data as CourseMaterial;
}

export interface AddMaterialLinkInput {
  courseId: string;
  title: string;
  description: string;
  url: string;
}

export async function addMaterialLink(input: AddMaterialLinkInput): Promise<CourseMaterial> {
  const { data, error } = await supabase
    .from("course_materials")
    .insert({
      course_id: input.courseId,
      title: input.title.trim(),
      description: input.description.trim() || null,
      kind: "link",
      url: input.url.trim(),
    })
    .select()
    .single();
  if (error) throw error;
  return data as CourseMaterial;
}

export async function deleteMaterial(material: CourseMaterial): Promise<void> {
  if (material.storage_path) {
    await supabase.storage.from(BUCKET).remove([material.storage_path]);
  }
  const { error } = await supabase.from("course_materials").delete().eq("id", material.id);
  if (error) throw error;
}
