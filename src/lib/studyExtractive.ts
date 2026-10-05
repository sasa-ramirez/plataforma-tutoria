/** Notas por tema armadas DIRECTAMENTE del texto (sin IA).
 *
 * Es el respaldo que garantiza que un documento siempre quede utilizable,
 * aunque la IA esté caída, lenta o devuelva basura: cuesta cero, tarda
 * milisegundos y no puede fallar por culpa de un modelo. Las diapositivas y
 * los apuntes ya vienen estructurados (título + viñetas), así que agrupar
 * páginas consecutivas por tamaño da temas razonables; la IA, cuando
 * funciona, solo los mejora. */

export interface NoteDraft {
  topic: string;
  summary: string;
  key_points: string[];
}

const BULLET = /^[\s•·▪▫◦●○■□►▶→➢✓✔*\-–—]+|^\(?\d{1,2}[.)]\s+/;
const GENERIC = /^(contenido|índice|indice|agenda|gracias|preguntas|referencias|bibliografía|bibliografia|objetivos?|portada|presentación|presentacion)\.?$/i;

const clean = (s: string) => s.replace(BULLET, "").replace(/\s+/g, " ").trim();
const clip = (s: string, n: number) => (s.length <= n ? s : s.slice(0, n - 1).trimEnd() + "…");

/** Primera línea utilizable como título: corta y sin punto final. */
function pickTitle(lines: string[]): string | null {
  const first = lines[0];
  if (!first) return null;
  const t = clean(first);
  if (t.length < 3 || t.length > 100) return null;
  if (/[.;]$/.test(t) && t.split(" ").length > 8) return null; // parece una frase, no un título
  return t.replace(/[:：]\s*$/, "");
}

interface PageInfo {
  n: number; // número de página/diapositiva (1-based)
  title: string | null;
  lines: string[]; // cuerpo, sin la línea del título
  chars: number;
}

function toPage(n: number, text: string): PageInfo | null {
  const lines = text
    .split("\n")
    .map((l) => l.replace(/^\(Notas\)\s*/, "").trim())
    .filter((l) => l.length > 1);
  const total = lines.join(" ").length;
  if (total < 40) return null; // portada, separador, solo una imagen
  const title = pickTitle(lines);
  return { n, title, lines: title ? lines.slice(1) : lines, chars: total };
}

/**
 * @param pages  texto de cada página/diapositiva (ya limpio)
 * @param firstPage número de la primera (para "Página N" cuando no hay título)
 * @param unit "Página" o "Diapositiva"
 * @param groupChars tamaño objetivo de cada tema: más grande = menos temas
 */
export function extractiveNotes(
  pages: string[],
  firstPage: number,
  unit: "Página" | "Diapositiva",
  groupChars = 1100,
): NoteDraft[] {
  const infos = pages
    .map((t, i) => toPage(firstPage + i, t))
    .filter((p): p is PageInfo => p !== null);

  // Agrupar páginas consecutivas hasta alcanzar el tamaño objetivo (máx. 6 por tema).
  const groups: PageInfo[][] = [];
  let cur: PageInfo[] = [];
  let size = 0;
  for (const p of infos) {
    cur.push(p);
    size += p.chars;
    if (size >= groupChars || cur.length >= 6) {
      groups.push(cur);
      cur = [];
      size = 0;
    }
  }
  if (cur.length) {
    // Un resto muy corto se pega al grupo anterior en vez de quedar como tema suelto.
    if (groups.length > 0 && size < groupChars / 3) groups[groups.length - 1].push(...cur);
    else groups.push(cur);
  }

  const notes: NoteDraft[] = [];
  for (const g of groups) {
    const titled = g.find((p) => p.title && !GENERIC.test(p.title));
    const topic = clip(
      titled?.title ?? (g[0].title && !GENERIC.test(g[0].title) ? g[0].title : `${unit} ${g[0].n}${g.length > 1 ? `–${g[g.length - 1].n}` : ""}`),
      80,
    );

    // Todas las líneas del grupo (con el título de cada página como encabezado de sección).
    const body: string[] = [];
    for (const p of g) {
      if (p.title && p !== titled && !GENERIC.test(p.title)) body.push(p.title);
      body.push(...p.lines);
    }
    const lines = [...new Set(body.map(clean).filter((l) => l.length >= 3))];
    if (lines.length === 0) continue;

    // Resumen = las primeras líneas completas; puntos clave = el resto (viñetas).
    let summary = "";
    let i = 0;
    while (i < lines.length && summary.length < 360) summary += (summary ? " " : "") + lines[i++];
    const key_points = lines.slice(i, i + 8).map((l) => clip(l, 220));

    notes.push({ topic, summary: clip(summary, 700), key_points });
  }
  return notes;
}
