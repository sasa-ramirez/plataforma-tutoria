import { fetchTemplateBuffer, type TemplateKey } from "@/services/documentTemplates";

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * Usa la plantilla que coordinación haya subido (Supabase Storage) si hay
 * una; si no hay ninguna subida (o falla la descarga), cae a la que viene
 * incluida de fábrica en el código. Así el formato oficial se puede
 * actualizar sin tocar código ni desplegar de nuevo.
 */
export async function loadDocxTemplate(
  key: TemplateKey,
  fallbackBase64: string,
): Promise<Uint8Array> {
  try {
    const custom = await fetchTemplateBuffer(key);
    if (custom) return new Uint8Array(custom);
  } catch {
    /* si Storage falla, se usa la de fábrica */
  }
  return base64ToUint8Array(fallbackBase64);
}
