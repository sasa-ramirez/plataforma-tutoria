/** Cómo mostrar una pregunta de quiz sin repetir el mismo texto dos veces.
 *
 * Las preguntas de la IA traen un título corto y un enunciado largo (se
 * muestran los dos). Las que crea el tutor a mano guardan la pregunta como
 * título (recortado con "…" si es larga) y, si es larga, el texto completo
 * como enunciado: aquí se detecta ese caso y se muestra solo una vez. */
export function splitQuestion(ex: { title: string; prompt: string }): {
  heading: string | null;
  body: string;
} {
  const title = (ex.title ?? "").trim();
  const prompt = (ex.prompt ?? "").trim();
  if (!prompt) return { heading: null, body: title };
  if (title === prompt) return { heading: null, body: prompt };
  if (title.endsWith("…") && prompt.startsWith(title.slice(0, -1).trimEnd())) {
    return { heading: null, body: prompt };
  }
  return { heading: title, body: prompt };
}

/** Título guardado para una pregunta escrita a mano: la pregunta misma, recortada. */
export function titleFromQuestion(question: string, max = 100): string {
  const q = question.replace(/\s+/g, " ").trim();
  return q.length <= max ? q : q.slice(0, max - 1).trimEnd() + "…";
}
