import type { PeriodicReport } from "@/types/database";
import { fetchReportPhotoUrl } from "@/services/reports";
import { loadDocxTemplate } from "@/lib/loadDocxTemplate";

const MESES = [
  "ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO",
  "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE",
];

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

/** pizzip, docxtemplater y docxtemplater-image son CJS puros; según el
 * entorno el import dinámico los expone en `.default` o directamente en
 * el módulo — se prueban ambos, igual que con exceljs en exportTutoring.ts. */
function cjsDefault<T>(mod: unknown): T {
  return ((mod as { default?: T }).default ?? mod) as T;
}

interface DocxtemplaterInstance {
  render(data: Record<string, unknown>): void;
  getZip(): { generate(opts: { type: "arraybuffer" }): ArrayBuffer };
}
type DocxtemplaterCtor = new (
  zip: unknown,
  opts: { modules: unknown[]; paragraphLoop: boolean; linebreaks: boolean },
) => DocxtemplaterInstance;
type PizZipCtor = new (data: Uint8Array) => unknown;
type ImageModuleCtor = new (opts: {
  centered: boolean;
  getImage: () => Uint8Array;
  getSize: () => [number, number];
}) => unknown;

/**
 * Genera el Word del informe periódico (buffer en memoria) usando la
 * plantilla oficial real (BS-F-17) sin cambiar su formato — solo se
 * rellenan los campos ({dia}, {lugar}, etc.) que se insertaron en el
 * documento original. Todas las librerías pesadas se cargan bajo demanda
 * para no engordar el paquete principal. Se usa tanto para la descarga
 * como para la vista previa (mismo documento, sin generarlo dos veces).
 */
export async function renderPeriodicReportDocx(report: PeriodicReport): Promise<ArrayBuffer> {
  const [pizzipMod, docxtemplaterMod, imageModuleMod, { BS_F17_TEMPLATE_BASE64 }] =
    await Promise.all([
      import("pizzip"),
      import("docxtemplater"),
      import("docxtemplater-image"),
      import("@/assets/tutoring/bs-f17-template"),
    ]);
  const PizZip = cjsDefault<PizZipCtor>(pizzipMod);
  const Docxtemplater = cjsDefault<DocxtemplaterCtor>(docxtemplaterMod);
  const ImageModule = cjsDefault<ImageModuleCtor>(imageModuleMod);

  const [templateBytes, photo] = await Promise.all([
    loadDocxTemplate("bs-f17", BS_F17_TEMPLATE_BASE64),
    (async () => {
      if (!report.photo_path) return null;
      const url = await fetchReportPhotoUrl(report.photo_path);
      const res = await fetch(url);
      return new Uint8Array(await res.arrayBuffer());
    })(),
  ]);

  const zip = new PizZip(templateBytes);
  const imageModule = new ImageModule({
    centered: false,
    getImage: () => photo as Uint8Array,
    getSize: () => [280, 190],
  });
  const doc = new Docxtemplater(zip, {
    modules: [imageModule],
    paragraphLoop: true,
    linebreaks: true,
  });

  const fecha = new Date(report.report_date + "T00:00:00");

  doc.render({
    dia: String(fecha.getDate()).padStart(2, "0"),
    mes: MESES[fecha.getMonth()],
    anio: String(fecha.getFullYear()),
    lugar: report.place,
    responsable: report.tutor_name ?? "",
    grupo: report.group_label ?? "",
    participantes: report.participants_count ?? "",
    programa: report.program_name ?? "",
    asignatura: report.subject_name ?? "",
    semestre: report.semester ?? "",
    docente: report.professor_name ?? "",
    temas: report.topics ?? "",
    descripcion: report.description,
    observaciones: report.observations ?? "",
    // El módulo de imagen solo inserta la foto si este valor es "truthy";
    // si no hay foto, el tag {%foto} se resuelve como texto vacío.
    foto: photo ? "1" : "",
  });

  return doc.getZip().generate({ type: "arraybuffer" });
}

export async function downloadPeriodicReportDocx(report: PeriodicReport): Promise<void> {
  const out = await renderPeriodicReportDocx(report);
  downloadBlob(out, `informe_periodico_${report.report_date}.docx`);
}
