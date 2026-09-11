import { supabase } from "@/lib/supabase";

const BUCKET = "document-templates";

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** Claves fijas — un archivo por formato, se reemplaza (upsert) cada vez
 * que coordinación sube uno nuevo. "bs-f17" y "ad-f01" son plantillas
 * activas (la app las rellena automático); el resto quedan guardadas
 * como referencia del formato oficial vigente, sin que el código las lea
 * todavía. */
export type TemplateKey =
  | "bs-f17"
  | "ad-f01"
  | "bs-f51"
  | "bs-f75"
  | "seguimiento-xlsx"
  | "registro-asistencias-xlsx";

interface TemplateDef {
  path: string;
  mime: string;
  extensions: string[];
  /** Solo para plantillas activas: los {tag} que docxtemplater necesita
   * encontrar en el documento para poder rellenarlo. */
  requiredTags?: string[];
}

const TEMPLATES: Record<TemplateKey, TemplateDef> = {
  "bs-f17": {
    path: "bs-f17.docx",
    mime: DOCX_MIME,
    extensions: [".docx"],
    requiredTags: [
      "{dia}", "{mes}", "{anio}", "{lugar}", "{responsable}", "{grupo}",
      "{participantes}", "{programa}", "{asignatura}", "{semestre}",
      "{docente}", "{temas}", "{descripcion}", "{observaciones}", "%foto",
    ],
  },
  "ad-f01": {
    path: "ad-f01.docx",
    mime: DOCX_MIME,
    extensions: [".docx"],
    requiredTags: [
      "{acta_numero}", "{fecha}", "{organismo}", "{asunto}", "{orden_dia}",
      "{desarrollo}", "{conclusiones}", "{compromisos}", "{observaciones}",
      "{tutor_nombre}", "{docente_nombre}", "{programa}",
    ],
  },
  "bs-f51": { path: "bs-f51.docx", mime: DOCX_MIME, extensions: [".docx"] },
  "bs-f75": { path: "bs-f75.docx", mime: DOCX_MIME, extensions: [".docx"] },
  "seguimiento-xlsx": { path: "seguimiento.xlsx", mime: XLSX_MIME, extensions: [".xlsx"] },
  "registro-asistencias-xlsx": {
    path: "registro-asistencias.xlsx",
    mime: XLSX_MIME,
    extensions: [".xlsx"],
  },
};

export interface TemplateInfo {
  key: TemplateKey;
  updatedAt: string;
  sizeBytes: number;
}

/** Info del archivo subido (o null si nadie ha subido ninguno todavía —
 * para bs-f17/ad-f01 eso significa que se está usando la plantilla de
 * fábrica incluida en la app). */
export async function fetchTemplateInfo(key: TemplateKey): Promise<TemplateInfo | null> {
  const def = TEMPLATES[key];
  const { data, error } = await supabase.storage.from(BUCKET).list("", { search: def.path });
  if (error) throw error;
  const file = data?.find((f) => f.name === def.path);
  if (!file) return null;
  return {
    key,
    updatedAt: file.updated_at ?? file.created_at ?? "",
    sizeBytes: file.metadata?.size ?? 0,
  };
}

/** Descarga el archivo subido como ArrayBuffer, o null si no hay ninguno
 * (para que el generador use la plantilla de fábrica como respaldo). */
export async function fetchTemplateBuffer(key: TemplateKey): Promise<ArrayBuffer | null> {
  const { data, error } = await supabase.storage.from(BUCKET).download(TEMPLATES[key].path);
  if (error) {
    // Objeto no encontrado: no hay nada subido, no es un error real.
    return null;
  }
  return data.arrayBuffer();
}

/** pizzip es CJS puro; según el entorno el import dinámico lo expone en
 * `.default` o directamente en el módulo. */
function cjsDefault<T>(mod: unknown): T {
  return ((mod as { default?: T }).default ?? mod) as T;
}

/**
 * Para bs-f17/ad-f01: revisa que el .docx traiga todos los {tag} que la
 * app necesita para rellenarlo, ANTES de subirlo — así, si alguien sube
 * el formato crudo sin etiquetar (o quedó mal etiquetado), se avisa ahí
 * mismo en vez de romper el documento de un estudiante después.
 * Devuelve la lista de tags que faltan (vacía si está todo bien).
 */
export async function findMissingTags(key: TemplateKey, file: File): Promise<string[]> {
  const requiredTags = TEMPLATES[key].requiredTags;
  if (!requiredTags) return [];

  const [PizZipMod, buffer] = await Promise.all([import("pizzip"), file.arrayBuffer()]);
  const PizZip = cjsDefault<new (data: ArrayBuffer) => { file(name: string): { asText(): string } | null }>(
    PizZipMod,
  );

  let text: string;
  try {
    const zip = new PizZip(buffer);
    const doc = zip.file("word/document.xml");
    if (!doc) throw new Error("no es un .docx válido (falta word/document.xml)");
    text = doc.asText();
  } catch {
    // Si ni siquiera se puede abrir como zip/docx, faltan "todos" los tags.
    return requiredTags;
  }

  return requiredTags.filter((tag) => !text.includes(tag));
}

export async function uploadTemplate(key: TemplateKey, file: File): Promise<void> {
  const def = TEMPLATES[key];
  const { error } = await supabase.storage.from(BUCKET).upload(def.path, file, {
    contentType: def.mime,
    upsert: true,
  });
  if (error) throw error;
}

export async function deleteTemplate(key: TemplateKey): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).remove([TEMPLATES[key].path]);
  if (error) throw error;
}
