import type { TemplateKey } from "@/services/documentTemplates";

/** pizzip es CJS puro; según el entorno el import dinámico lo expone en
 * `.default` o directamente en el módulo. */
function cjsDefault<T>(mod: unknown): T {
  return ((mod as { default?: T }).default ?? mod) as T;
}

interface PizZipFileApi {
  asText(): string;
}
interface PizZipInstance {
  file(name: string): PizZipFileApi | null;
  file(name: string, content: string): void;
  generate(opts: { type: "arraybuffer" }): ArrayBuffer;
}
type PizZipCtor = new (data: ArrayBuffer) => PizZipInstance;

// ---------------------------------------------------------------------
// Motor de auto-etiquetado: encuentra cada campo por el texto fijo que
// lo acompaña ("Lugar:", "DESARROLLO", etc.) e inserta el {tag} ahí, sin
// depender de paraId ni de la versión exacta del documento — así sigue
// funcionando aunque la universidad cambie una revisión menor (texto,
// diseño) del formato. Si una etiqueta ya no se encuentra o el campo no
// tiene un texto fijo cerca (como los nombres de firma), queda en
// "missing" para que alguien lo revise a mano.
// ---------------------------------------------------------------------

interface FieldSpec {
  tag: string;
  /** Texto fijo junto al campo (la etiqueta visible en el Word). */
  anchor: string;
  /** Si el texto aparece varias veces, cuál ocurrencia usar (1 = primera). */
  occurrence?: number;
  /** "inline": el valor va en el mismo párrafo, justo después del anchor.
   *  "next-nonempty": el valor está en el primer párrafo con texto que
   *  sigue al párrafo del anchor (para secciones tipo "DESARROLLO" con
   *  el contenido en la línea de abajo).
   *  "offset": el valor está exactamente `offset` párrafos después del
   *  anchor (0 = el mismo párrafo del anchor, completo) — para tablas
   *  con estructura fija (fecha) o una celda que ya trae un texto guía
   *  fijo (la celda de la foto dice literalmente "(imagen)"). */
  mode: "inline" | "next-nonempty" | "offset";
  offset?: number;
  /** Texto completo a insertar si no es simplemente "{tag}" (ej. "{grupo}."). */
  tagText?: string;
}

const BS_F17_SPECS: FieldSpec[] = [
  { tag: "lugar", anchor: "Lugar:", mode: "inline" },
  { tag: "responsable", anchor: "Responsable:", mode: "inline" },
  { tag: "grupo", anchor: "Grupo ", mode: "inline", tagText: "{grupo}." },
  { tag: "participantes", anchor: "Número de participantes:", mode: "inline" },
  { tag: "programa", anchor: "Programa:", mode: "inline" },
  { tag: "asignatura", anchor: "Asignatura:", mode: "inline" },
  { tag: "semestre", anchor: "Semestre:", mode: "inline" },
  { tag: "docente", anchor: "Docente:", mode: "inline" },
  { tag: "temas", anchor: "Temas desarrollados:", mode: "inline" },
  { tag: "descripcion", anchor: "Descripción:", mode: "inline" },
  { tag: "observaciones", anchor: "Observaciones:", mode: "inline" },
  // Tabla de fecha: "Día"/"Mes"/"Año" son el encabezado; el valor está
  // exactamente 3 párrafos después (la celda correspondiente de la fila
  // de abajo).
  { tag: "dia", anchor: "Día", mode: "offset", offset: 3 },
  { tag: "mes", anchor: "Mes", mode: "offset", offset: 3 },
  { tag: "anio", anchor: "Año", mode: "offset", offset: 3 },
  // La celda de la foto ya trae un texto guía fijo "(imagen)".
  { tag: "foto", anchor: "(imagen)", mode: "offset", offset: 0, tagText: "{%foto}" },
];

const AD_F01_SPECS: FieldSpec[] = [
  { tag: "acta_numero", anchor: "ACTA N°", mode: "inline" },
  { tag: "fecha", anchor: "FECHA:", mode: "next-nonempty" },
  { tag: "organismo", anchor: "ORGANISMO", mode: "next-nonempty" },
  { tag: "asunto", anchor: "ASUNTO:", mode: "next-nonempty" },
  { tag: "orden_dia", anchor: "ORDEN DEL DÍA", mode: "next-nonempty" },
  { tag: "desarrollo", anchor: "DESARROLLO", mode: "next-nonempty" },
  { tag: "conclusiones", anchor: "CONCLUSIONES", mode: "next-nonempty" },
  { tag: "compromisos", anchor: "COMPROMISOS ADQUIRIDOS", mode: "next-nonempty" },
  { tag: "observaciones", anchor: "OBSERVACIONES", mode: "next-nonempty" },
  { tag: "programa", anchor: "Área", occurrence: 2, mode: "next-nonempty" },
  // tutor_nombre/docente_nombre (nombres de firma) no tienen ninguna
  // etiqueta pegada -> siempre quedan para revisión manual.
];

const SPECS_BY_KEY: Partial<Record<TemplateKey, FieldSpec[]>> = {
  "bs-f17": BS_F17_SPECS,
  "ad-f01": AD_F01_SPECS,
};

function decodeXmlText(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

interface ParaSpan {
  start: number;
  end: number;
  xml: string;
}

function splitParagraphs(xml: string): ParaSpan[] {
  const paras: ParaSpan[] = [];
  const re = /<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    paras.push({ start: m.index, end: m.index + m[0].length, xml: m[0] });
  }
  return paras;
}

function paragraphText(paraXml: string): string {
  return [...paraXml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)]
    .map((x) => decodeXmlText(x[1]))
    .join("");
}

interface Chunk {
  raw: string;
  text: string;
  rPr: string;
}

function paragraphChunks(paraXml: string): { head: string; chunks: Chunk[] } {
  const pprEnd = paraXml.indexOf("</w:pPr>");
  const bodyStart = pprEnd === -1 ? paraXml.indexOf(">") + 1 : pprEnd + "</w:pPr>".length;
  const head = paraXml.slice(0, bodyStart);
  const bodyAndTail = paraXml.slice(bodyStart);
  const tailIdx = bodyAndTail.lastIndexOf("</w:p>");
  const body = bodyAndTail.slice(0, tailIdx);

  const chunkRe = /<w:sdt\b[\s\S]*?<\/w:sdt>|<w:r\b[\s\S]*?<\/w:r>/g;
  const chunks: Chunk[] = [];
  let m: RegExpExecArray | null;
  while ((m = chunkRe.exec(body))) {
    const raw = m[0];
    const text = [...raw.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)]
      .map((x) => decodeXmlText(x[1]))
      .join("");
    const rPrMatch = raw.match(/<w:rPr>[\s\S]*?<\/w:rPr>/);
    chunks.push({ raw, text, rPr: rPrMatch ? rPrMatch[0] : "" });
  }
  return { head, chunks };
}

function makeRun(rPr: string, text: string): string {
  return `<w:r>${rPr}<w:t xml:space="preserve">${text}</w:t></w:r>`;
}

/** Dentro del mismo párrafo del anchor, reemplaza (o agrega, si no había
 * nada) el valor por el tag. Devuelve null si el anchor no aparece ahí. */
function tagInline(paraXml: string, anchor: string, tag: string): string | null {
  const { head, chunks } = paragraphChunks(paraXml);
  const fullText = chunks.map((c) => c.text).join("");
  const idx = fullText.indexOf(anchor);
  if (idx === -1) return null;

  let anchorEnd = idx + anchor.length;
  // Si en el original había un espacio pegado a la etiqueta ("Lugar: "),
  // lo conservamos aunque el anchor no lo incluya.
  while (fullText[anchorEnd] === " ") anchorEnd++;

  let acc = 0;
  let cutIndex = -1;
  let keepLen = 0;
  for (let i = 0; i < chunks.length; i++) {
    const len = chunks[i].text.length;
    if (acc + len >= anchorEnd) {
      cutIndex = i;
      keepLen = anchorEnd - acc;
      break;
    }
    acc += len;
  }
  if (cutIndex === -1) return null;

  const kept = chunks.slice(0, cutIndex + 1);
  const cutChunk = kept[cutIndex];
  if (keepLen < cutChunk.text.length) {
    // El anchor termina a mitad del chunk: solo se trunca si tiene
    // exactamente un <w:t> (caso normal de un run simple).
    const tCount = (cutChunk.raw.match(/<w:t(?:\s[^>]*)?>/g) || []).length;
    if (tCount === 1) {
      const truncatedText = cutChunk.text.slice(0, keepLen);
      const newRaw = cutChunk.raw.replace(
        /<w:t(?:\s[^>]*)?>[\s\S]*?<\/w:t>/,
        `<w:t xml:space="preserve">${truncatedText}</w:t>`,
      );
      kept[cutIndex] = { ...cutChunk, raw: newRaw };
    }
    // si tiene varios <w:t>, se deja completo (degradación aceptable)
  }

  const valueChunk = chunks[cutIndex + 1];
  const rPr = (valueChunk && valueChunk.rPr) || cutChunk.rPr || "";
  const lastCharKept = fullText[anchorEnd - 1];
  const needsSpace = lastCharKept !== undefined && lastCharKept !== " ";
  const newRun = makeRun(rPr, (needsSpace ? " " : "") + tag);

  const newBody = kept.map((c) => c.raw).join("") + newRun;
  return head + newBody + "</w:p>";
}

/** Reemplaza TODO el contenido del párrafo (que se asume es solo el
 * valor, sin compartir texto con ninguna etiqueta) por el tag. */
function replaceWholeBody(paraXml: string, tag: string): string {
  const { head, chunks } = paragraphChunks(paraXml);
  const rPr = (chunks[0] && chunks[0].rPr) || "";
  return head + makeRun(rPr, tag) + "</w:p>";
}

function applySpecs(documentXml: string, specs: FieldSpec[]): {
  xml: string;
  applied: string[];
  missing: string[];
} {
  let xml = documentXml;
  const applied: string[] = [];
  const missing: string[] = [];

  for (const spec of specs) {
    const occurrence = spec.occurrence ?? 1;
    const paras = splitParagraphs(xml);
    let seen = 0;
    let targetIdx = -1;
    for (let i = 0; i < paras.length; i++) {
      if (paragraphText(paras[i].xml).includes(spec.anchor)) {
        seen++;
        if (seen === occurrence) {
          targetIdx = i;
          break;
        }
      }
    }
    if (targetIdx === -1) {
      missing.push(spec.tag);
      continue;
    }

    const tagText = spec.tagText ?? `{${spec.tag}}`;

    if (spec.mode === "inline") {
      const newParaXml = tagInline(paras[targetIdx].xml, spec.anchor, tagText);
      if (!newParaXml) {
        missing.push(spec.tag);
        continue;
      }
      xml = xml.slice(0, paras[targetIdx].start) + newParaXml + xml.slice(paras[targetIdx].end);
      applied.push(spec.tag);
    } else if (spec.mode === "next-nonempty") {
      let j = targetIdx + 1;
      while (j < paras.length && paragraphText(paras[j].xml).trim() === "") j++;
      if (j >= paras.length) {
        missing.push(spec.tag);
        continue;
      }
      const newParaXml = replaceWholeBody(paras[j].xml, tagText);
      xml = xml.slice(0, paras[j].start) + newParaXml + xml.slice(paras[j].end);
      applied.push(spec.tag);
    } else {
      // "offset": párrafo objetivo a una distancia fija del anchor
      // (0 = el mismo párrafo). Se reemplaza completo, esté vacío o no.
      const j = targetIdx + (spec.offset ?? 0);
      if (j < 0 || j >= paras.length) {
        missing.push(spec.tag);
        continue;
      }
      const newParaXml = replaceWholeBody(paras[j].xml, tagText);
      xml = xml.slice(0, paras[j].start) + newParaXml + xml.slice(paras[j].end);
      applied.push(spec.tag);
    }
  }

  return { xml, applied, missing };
}

export interface AutoTagResult {
  buffer: ArrayBuffer;
  applied: string[];
  missing: string[];
}

/**
 * Intenta etiquetar automáticamente un .docx crudo (sin {tags}) buscando
 * las etiquetas fijas conocidas de cada formato. Devuelve null si este
 * tipo de documento no tiene un auto-etiquetador definido (los formatos
 * de solo-referencia como BS-F-51 o los .xlsx).
 */
export async function autoTagTemplate(
  key: TemplateKey,
  buffer: ArrayBuffer,
): Promise<AutoTagResult | null> {
  const specs = SPECS_BY_KEY[key];
  if (!specs) return null;

  const PizZip = cjsDefault<PizZipCtor>(await import("pizzip"));
  const zip = new PizZip(buffer);
  const docFile = zip.file("word/document.xml");
  if (!docFile) return { buffer, applied: [], missing: specs.map((s) => s.tag) };

  const { xml, applied, missing } = applySpecs(docFile.asText(), specs);
  if (applied.length === 0) return { buffer, applied, missing };

  zip.file("word/document.xml", xml);
  return { buffer: zip.generate({ type: "arraybuffer" }), applied, missing };
}

// Expuestas solo para pruebas unitarias (operan sobre XML en memoria, sin
// necesitar pizzip ni un .docx real) — no son parte de la API pública.
export const _internal = {
  applySpecs,
  tagInline,
  replaceWholeBody,
  splitParagraphs,
  paragraphText,
  BS_F17_SPECS,
  AD_F01_SPECS,
};
