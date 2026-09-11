import { supabase } from "@/lib/supabase";

const BUCKET = "document-templates";

/** Claves fijas — un archivo por tipo de documento, se reemplaza (upsert)
 * cada vez que coordinación sube uno nuevo. */
export type TemplateKey = "bs-f17" | "ad-f01";

const TEMPLATE_PATH: Record<TemplateKey, string> = {
  "bs-f17": "bs-f17.docx",
  "ad-f01": "ad-f01.docx",
};

export interface TemplateInfo {
  key: TemplateKey;
  updatedAt: string;
  sizeBytes: number;
}

/** Info de la plantilla subida (o null si nadie ha subido ninguna
 * todavía y se está usando la de fábrica incluida en la app). */
export async function fetchTemplateInfo(key: TemplateKey): Promise<TemplateInfo | null> {
  const { data, error } = await supabase.storage.from(BUCKET).list("", {
    search: TEMPLATE_PATH[key],
  });
  if (error) throw error;
  const file = data?.find((f) => f.name === TEMPLATE_PATH[key]);
  if (!file) return null;
  return {
    key,
    updatedAt: file.updated_at ?? file.created_at ?? "",
    sizeBytes: file.metadata?.size ?? 0,
  };
}

/** Descarga la plantilla subida como ArrayBuffer, o null si no hay
 * ninguna (para que el generador use la de fábrica como respaldo). */
export async function fetchTemplateBuffer(key: TemplateKey): Promise<ArrayBuffer | null> {
  const { data, error } = await supabase.storage.from(BUCKET).download(TEMPLATE_PATH[key]);
  if (error) {
    // Objeto no encontrado: no hay plantilla subida, no es un error real.
    return null;
  }
  return data.arrayBuffer();
}

export async function uploadTemplate(key: TemplateKey, file: File): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).upload(TEMPLATE_PATH[key], file, {
    contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    upsert: true,
  });
  if (error) throw error;
}

export async function deleteTemplate(key: TemplateKey): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).remove([TEMPLATE_PATH[key]]);
  if (error) throw error;
}
