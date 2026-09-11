import type { Acta } from "@/types/database";

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function downloadBlob(buffer: ArrayBuffer, filename: string) {
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** pizzip y docxtemplater son CJS puros; según el entorno el import
 * dinámico los expone en `.default` o directamente en el módulo — se
 * prueban ambos, igual que con exceljs en exportTutoring.ts. */
function cjsDefault<T>(mod: unknown): T {
  return ((mod as { default?: T }).default ?? mod) as T;
}

interface DocxtemplaterInstance {
  render(data: Record<string, unknown>): void;
  getZip(): { generate(opts: { type: "arraybuffer" }): ArrayBuffer };
}
type DocxtemplaterCtor = new (
  zip: unknown,
  opts: { paragraphLoop: boolean; linebreaks: boolean },
) => DocxtemplaterInstance;
type PizZipCtor = new (data: Uint8Array) => unknown;

/**
 * Genera el Word del acta usando la plantilla oficial real (AD-F-01) sin
 * cambiar su formato — solo se rellenan los campos que se insertaron en
 * el documento original. Las firmas quedan en blanco para firmar a mano,
 * igual que en el informe periódico. Las librerías pesadas se cargan
 * bajo demanda para no engordar el paquete principal.
 */
export async function downloadActaDocx(acta: Acta): Promise<void> {
  const [pizzipMod, docxtemplaterMod, { AD_F01_TEMPLATE_BASE64 }] = await Promise.all([
    import("pizzip"),
    import("docxtemplater"),
    import("@/assets/tutoring/ad-f01-template"),
  ]);
  const PizZip = cjsDefault<PizZipCtor>(pizzipMod);
  const Docxtemplater = cjsDefault<DocxtemplaterCtor>(docxtemplaterMod);

  const zip = new PizZip(base64ToUint8Array(AD_F01_TEMPLATE_BASE64));
  const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });

  const fecha = new Date(acta.acta_date + "T00:00:00");

  doc.render({
    acta_numero: acta.acta_number ?? "",
    fecha: `${fecha.getDate()} de ${MESES[fecha.getMonth()]} de ${fecha.getFullYear()}`,
    organismo: acta.organismo,
    asunto: acta.asunto ?? "",
    orden_dia: acta.orden_dia ?? "",
    desarrollo: acta.desarrollo,
    conclusiones: acta.conclusiones ?? "",
    compromisos: acta.compromisos ?? "",
    observaciones: acta.observaciones ?? "",
    tutor_nombre: (acta.tutor_name ?? "").toUpperCase(),
    docente_nombre: (acta.professor_name ?? "").toUpperCase(),
    programa: (acta.program_name ?? "").toUpperCase(),
  });

  const out = doc.getZip().generate({ type: "arraybuffer" });
  downloadBlob(out, `acta_${acta.acta_date}.docx`);
}
