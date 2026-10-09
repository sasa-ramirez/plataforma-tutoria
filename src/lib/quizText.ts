/** Cómo mostrar una pregunta de quiz sin repetir el mismo texto dos veces.
 *
 * Las preguntas de la IA traen un título corto y un enunciado largo (se
 * muestran los dos). Las que crea el tutor a mano guardan la pregunta como
 * título (en una sola línea, recortada con "…" si es larga) y, si es larga o
 * tiene varias líneas (código), el texto completo como enunciado: aquí se
 * detecta ese caso y se muestra solo una vez. */

const collapse = (s: string) => s.replace(/\s+/g, " ").trim();

export function splitQuestion(ex: { title: string; prompt: string }): {
  heading: string | null;
  body: string;
} {
  const title = collapse(ex.title ?? "");
  const prompt = (ex.prompt ?? "").trim();
  if (!prompt) return { heading: null, body: (ex.title ?? "").trim() };
  const flat = collapse(prompt);
  if (title === flat) return { heading: null, body: prompt };
  if (title.endsWith("…") && flat.startsWith(title.slice(0, -1).trimEnd())) {
    return { heading: null, body: prompt };
  }
  return { heading: (ex.title ?? "").trim(), body: prompt };
}

/** Título guardado para una pregunta escrita a mano: la pregunta misma, en una línea y recortada. */
export function titleFromQuestion(question: string, max = 100): string {
  const q = collapse(question);
  return q.length <= max ? q : q.slice(0, max - 1).trimEnd() + "…";
}
