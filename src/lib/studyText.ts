/** pizzip es CJS puro; según el entorno el import dinámico lo expone en
 * `.default` o directamente en el módulo (mismo patrón que autoTagTemplate). */
function cjsDefault<T>(mod: unknown): T {
  return ((mod as { default?: T }).default ?? mod) as T;
}

export interface ZipFile {
  asText(): string;
}
export interface ZipInstance {
  files: Record<string, unknown>;
  file(name: string): ZipFile | null;
  file(name: string, content: string): void;
  generate(opts: { type: "uint8array" }): Uint8Array;
}
export type ZipCtor = new (data?: ArrayBuffer) => ZipInstance;

export async function loadZipCtor(): Promise<ZipCtor> {
  return cjsDefault<ZipCtor>(await import("pizzip"));
}

/** Texto de un documento, página por página (o diapositiva por diapositiva). */
export interface ExtractedDoc {
  kind: "pdf" | "pptx";
  /** pages[i] = texto de la página/diapositiva i+1 */
  pages: string[];
}

export interface TextChunk {
  /** "Páginas 1–8" / "Diapositivas 9–14": ayuda a la IA a ubicarse. */
  label: string;
  text: string;
}

export const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20 MB
export const MAX_DOC_CHARS = 150_000; // ~40k tokens: tope por documento
// Fragmentos chicos + varios a la vez = mucho más rápido que pocos fragmentos grandes
// (el tiempo de la IA depende de cuánto escribe, y cada fragmento escribe sus notas).
export const CHUNK_CHARS = 12_000;
const MIN_USEFUL_CHARS = 200;

export function detectKind(file: File): "pdf" | "pptx" | null {
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf") || file.type === "application/pdf") return "pdf";
  if (name.endsWith(".pptx")) return "pptx";
  return null;
}

// ---------------------------------------------------------------
// PPTX: es un zip con un XML por diapositiva (ppt/slides/slideN.xml).
// ---------------------------------------------------------------

const XML_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&apos;": "'",
};

const decodeXml = (s: string) =>
  s
    .replace(/&(amp|lt|gt|quot|apos);/g, (m) => XML_ENTITIES[m] ?? m)
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));

/** Texto de un XML de PowerPoint: un renglón por párrafo (<a:p>), uniendo sus <a:t>. */
export function textFromSlideXml(xml: string): string {
  const lines: string[] = [];
  for (const para of xml.split("</a:p>")) {
    const runs = [...para.matchAll(/<a:t(?:\s[^>]*)?>([\s\S]*?)<\/a:t>/g)].map((m) => decodeXml(m[1]));
    const line = runs.join("").trim();
    if (line) lines.push(line);
  }
  return lines.join("\n");
}

export async function extractPptx(buffer: ArrayBuffer): Promise<ExtractedDoc> {
  const PizZip = await loadZipCtor();
  let zip: ZipInstance;
  try {
    zip = new PizZip(buffer);
  } catch {
    throw new Error("No se pudo abrir el PowerPoint. ¿Está dañado?");
  }
  const slideNames = Object.keys(zip.files)
    .map((n) => ({ n, m: n.match(/^ppt\/slides\/slide(\d+)\.xml$/) }))
    .filter((x): x is { n: string; m: RegExpMatchArray } => !!x.m)
    .sort((a, b) => Number(a.m[1]) - Number(b.m[1]));

  if (slideNames.length === 0) {
    throw new Error(
      "No encontré diapositivas. Si es un archivo .ppt antiguo, ábrelo y guárdalo como .pptx.",
    );
  }

  const pages = slideNames.map(({ n, m }) => {
    const parts: string[] = [textFromSlideXml(zip.file(n)!.asText())];
    // Notas del orador de esa diapositiva (suelen traer la explicación real).
    const rels = zip.file(`ppt/slides/_rels/slide${m[1]}.xml.rels`)?.asText() ?? "";
    const notes = rels.match(/Target="\.\.\/notesSlides\/(notesSlide\d+\.xml)"/);
    if (notes) {
      const notesXml = zip.file(`ppt/notesSlides/${notes[1]}`)?.asText();
      if (notesXml) {
        // Se quita el número de diapositiva que PowerPoint mete como campo.
        const t = textFromSlideXml(notesXml).replace(/^\d+$/gm, "").trim();
        if (t) parts.push(`(Notas) ${t}`);
      }
    }
    return parts.join("\n").trim();
  });
  return { kind: "pptx", pages };
}

// ---------------------------------------------------------------
// PDF: pdf.js se carga bajo demanda (pesa; solo se descarga al subir un PDF).
// ---------------------------------------------------------------

export async function extractPdf(
  buffer: ArrayBuffer,
  onProgress?: (done: number, total: number) => void,
): Promise<ExtractedDoc> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  // Solo se fija si nadie lo hizo antes (los tests apuntan a un worker de disco).
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    const worker = (await import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url")).default;
    pdfjs.GlobalWorkerOptions.workerSrc = worker;
  }

  let doc;
  try {
    doc = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;
  } catch (e) {
    const name = (e as { name?: string })?.name;
    if (name === "PasswordException") throw new Error("El PDF tiene contraseña. Quítasela y vuelve a subirlo.");
    throw new Error("No se pudo abrir el PDF. ¿Está dañado?");
  }

  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    let text = "";
    for (const item of content.items) {
      if ("str" in item) text += item.str + (item.hasEOL ? "\n" : " ");
    }
    pages.push(text);
    page.cleanup();
    onProgress?.(i, doc.numPages);
  }
  await doc.destroy();
  return { kind: "pdf", pages };
}

export async function extractDocument(
  file: File,
  onProgress?: (done: number, total: number) => void,
): Promise<ExtractedDoc> {
  const kind = detectKind(file);
  if (!kind) throw new Error("Solo se aceptan archivos PDF o PowerPoint (.pptx).");
  if (file.size > MAX_FILE_BYTES) {
    throw new Error(`El archivo pesa más de ${MAX_FILE_BYTES / 1024 / 1024} MB.`);
  }
  const buffer = await file.arrayBuffer();
  return kind === "pdf" ? extractPdf(buffer, onProgress) : extractPptx(buffer);
}

// ---------------------------------------------------------------
// Limpieza y troceado
// ---------------------------------------------------------------

const normalize = (s: string) =>
  s
    .replace(/\r/g, "")
    .replace(/[ \t\u00a0]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

/** Quita renglones cortos que se repiten en casi todas las páginas
 * (encabezados, pies de página, nombre de la universidad): son ruido que
 * se pagaría como texto. Solo con documentos de 5+ páginas. */
export function stripRepeatedLines(pages: string[]): string[] {
  if (pages.length < 5) return pages;
  const seen = new Map<string, number>();
  for (const p of pages) {
    for (const line of new Set(p.split("\n").map((l) => l.trim()))) {
      if (line && line.length < 80) seen.set(line, (seen.get(line) ?? 0) + 1);
    }
  }
  const limit = Math.max(3, Math.ceil(pages.length * 0.4));
  const noise = new Set([...seen].filter(([, n]) => n >= limit).map(([l]) => l));
  if (noise.size === 0) return pages;
  return pages.map((p) =>
    p
      .split("\n")
      .filter((l) => !noise.has(l.trim()))
      .join("\n"),
  );
}

export interface PreparedDoc {
  chunks: TextChunk[];
  pageCount: number;
  charCount: number;
  /** El documento superó MAX_DOC_CHARS y se recortó al final. */
  truncated: boolean;
}

/** Limpia, recorta al tope por documento y reparte en fragmentos para la IA. */
export function prepareChunks(doc: ExtractedDoc, maxChars = CHUNK_CHARS): PreparedDoc {
  const noun = doc.kind === "pdf" ? "Página" : "Diapositiva";
  const cleaned = stripRepeatedLines(doc.pages.map(normalize));

  const total = cleaned.reduce((a, p) => a + p.length, 0);
  if (total < MIN_USEFUL_CHARS) {
    throw new Error(
      doc.kind === "pdf"
        ? "Casi no encontré texto. Si el PDF es de fotos o escaneado, no se puede leer; prueba con la versión original."
        : "Casi no encontré texto en las diapositivas (¿son solo imágenes?).",
    );
  }

  const chunks: TextChunk[] = [];
  let buf: string[] = [];
  let bufLen = 0;
  let first = 0;
  let used = 0;
  let truncated = false;

  const flush = (lastPage: number) => {
    if (buf.length === 0) return;
    const plural = noun === "Página" ? "Páginas" : "Diapositivas";
    chunks.push({
      label: first === lastPage ? `${noun} ${first}` : `${plural} ${first}–${lastPage}`,
      text: buf.join("\n\n"),
    });
    buf = [];
    bufLen = 0;
  };

  for (let i = 0; i < cleaned.length; i++) {
    let text = cleaned[i];
    if (!text) continue;
    if (used + text.length > MAX_DOC_CHARS) {
      text = text.slice(0, Math.max(0, MAX_DOC_CHARS - used));
      truncated = true;
    }
    // Una sola página gigante se parte para no pasarse del tope por llamada.
    for (let off = 0; off < text.length || off === 0; off += maxChars) {
      const part = text.slice(off, off + maxChars);
      if (!part) break;
      const block = `[${noun} ${i + 1}]\n${part}`;
      if (bufLen + block.length > maxChars && buf.length > 0) flush(i);
      if (buf.length === 0) first = i + 1;
      buf.push(block);
      bufLen += block.length;
      used += part.length;
    }
    if (truncated) {
      flush(i + 1);
      break;
    }
  }
  flush(cleaned.length);

  return { chunks, pageCount: doc.pages.length, charCount: used, truncated };
}
