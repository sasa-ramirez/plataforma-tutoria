/** Lee preguntas de opción múltiple pegadas como texto (de un Word, un PDF,
 * un chat…) para no tener que crearlas una por una. Es tolerante con el
 * formato: acepta preguntas numeradas o no, opciones "a) b) c)" o con
 * viñetas, y la correcta marcada con "*", "✓", "(correcta)" o con una línea
 * "Respuesta: B".
 *
 * Detalles pensados para texto pegado de Word:
 *  - Las líneas en blanco entre opciones NO cortan la pregunta.
 *  - Una pregunta puede tener varias líneas, incluido código (se conservan
 *    los saltos de línea y la sangría del código). */

export interface ParsedQuestion {
  question: string;
  options: string[];
  /** Índice de la correcta, o null si el texto no la indicaba (el tutor la elige después). */
  correct: number | null;
}

export interface ParseResult {
  questions: ParsedQuestion[];
  /** Avisos para el tutor (preguntas descartadas, marcas repetidas…). */
  warnings: string[];
}

const OPTION_LETTER = /^\s*(\*)?\s*\(?([a-fA-F])[).:-]\s*(.*)$/;
const OPTION_BULLET = /^\s*(\*)?\s*[-•·▪]\s+(.*)$/;
const QUESTION_START = /^\s*(?:pregunta\s*)?(\d{1,3})\s*[.):-]\s*(.+)$/i;
const ANSWER_LINE = /^\s*(?:respuesta(?:\s+correcta)?|rta\.?|resp\.?|correcta|clave|answer)\s*[:=-]?\s*(.+?)\s*$/i;

/** Marcas de "esta es la correcta" al final de la opción. */
const TRAILING_MARK = /\s*(?:\*+|✓|✔|✅|\((?:correcta|correct|x)\)|\[(?:x|✓)\])\s*$/i;

function stripMark(text: string): { text: string; marked: boolean } {
  let t = text.trim();
  let marked = false;
  while (TRAILING_MARK.test(t)) {
    t = t.replace(TRAILING_MARK, "").trim();
    marked = true;
  }
  return { text: t, marked };
}

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9ñ ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** ¿Parece una línea de código? (para conservar sus saltos de línea y no unirla con la anterior). */
const looksLikeCode = (l: string) => /[;{}=<>]|\w\(.*\)|^\s{2,}\S/.test(l);

/** Une una línea más a la pregunta: con salto si hay código de por medio, con espacio si es prosa. */
function appendLine(text: string, line: string): string {
  if (!text) return line.trim();
  const prevLast = text.split("\n").pop() ?? "";
  const code = looksLikeCode(prevLast) || looksLikeCode(line);
  // El código conserva su sangría; la prosa se limpia.
  const piece = looksLikeCode(line) ? line.replace(/\s+$/, "") : line.trim();
  return text + (code ? "\n" : " ") + piece;
}

interface Draft {
  text: string;
  options: string[];
  correct: number | null;
  conflict: boolean;
}

export function parseQuizText(raw: string): ParseResult {
  const warnings: string[] = [];
  const questions: ParsedQuestion[] = [];
  let cur: Draft | null = null;
  let discarded = 0;

  const close = () => {
    if (!cur) return;
    const q = cur;
    cur = null;
    const text = q.text.trim();
    if (!text || q.options.length < 2) {
      discarded++;
      return;
    }
    if (q.conflict) warnings.push(`«${text.slice(0, 40)}…» tenía más de una respuesta marcada: se tomó la primera.`);
    questions.push({ question: text, options: q.options, correct: q.correct });
  };
  const fresh = (text: string): Draft => ({ text, options: [], correct: null, conflict: false });

  for (const line of raw.replace(/\r/g, "").split("\n")) {
    // Las líneas en blanco no cortan nada: Word las mete entre cada opción.
    if (!line.trim()) continue;

    // "Respuesta: B" (o el texto de la respuesta) después de las opciones
    const ans = cur && cur.options.length > 0 ? line.match(ANSWER_LINE) : null;
    if (ans && cur) {
      const val = ans[1].trim();
      const letter = val.match(/^\(?([a-fA-F])\)?[).]?$/);
      let idx = -1;
      if (letter) idx = letter[1].toLowerCase().charCodeAt(0) - 97;
      else idx = cur.options.findIndex((o) => norm(o) === norm(val));
      if (idx >= 0 && idx < cur.options.length) {
        if (cur.correct === null) cur.correct = idx;
      } else {
        warnings.push(`No entendí la respuesta «${val}» de «${cur.text.slice(0, 40)}…».`);
      }
      continue;
    }

    // Opción (a) b) c)… o con viñeta)
    const optMatch = line.match(OPTION_LETTER) ?? line.match(OPTION_BULLET);
    if (optMatch && cur) {
      const leadingStar = !!optMatch[1];
      const body = optMatch[optMatch.length - 1];
      const { text, marked } = stripMark(body);
      if (text) {
        cur.options.push(text);
        if (marked || leadingStar) {
          if (cur.correct === null) cur.correct = cur.options.length - 1;
          else cur.conflict = true;
        }
      }
      continue;
    }

    // Inicio de pregunta numerada
    const start = line.match(QUESTION_START);
    if (start) {
      close();
      cur = fresh(start[2].trim());
      continue;
    }

    // Texto suelto: continúa la pregunta actual (si aún no tiene opciones) o abre una nueva.
    if (cur && cur.options.length === 0) {
      cur.text = appendLine(cur.text, line);
    } else {
      close();
      cur = fresh(line.trim());
    }
  }
  close();

  if (discarded > 0) {
    warnings.push(
      `${discarded} bloque${discarded === 1 ? "" : "s"} de texto no se pudo${discarded === 1 ? "" : "ieron"} leer como pregunta (¿faltan opciones?) y se omitió.`,
    );
  }
  return { questions, warnings };
}
