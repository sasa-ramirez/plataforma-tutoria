// Lógica pura del parcial simulado (sin Deno ni red) para poder probarla con vitest.

const MAX_PER_TOPIC = 5;

export interface Question {
  topic: string;
  question: string;
  options: string[];
  correct: number;
  explanation: string;
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Cuántas preguntas por tema: cubre todos los temas si alcanza, y si hay
 * más temas que preguntas, elige al azar (más probable los temas más ricos). */
export function allocate(
  topics: { name: string; weight: number }[],
  count: number,
): Map<string, number> {
  const out = new Map<string, number>();
  const pool = shuffle(topics);
  if (count <= pool.length) {
    // Sorteo ponderado sin reemplazo.
    const left = [...pool];
    while (out.size < count && left.length > 0) {
      const total = left.reduce((a, t) => a + t.weight, 0);
      let r = Math.random() * total;
      let idx = 0;
      for (let i = 0; i < left.length; i++) {
        r -= left[i].weight;
        if (r <= 0) {
          idx = i;
          break;
        }
      }
      out.set(left[idx].name, 1);
      left.splice(idx, 1);
    }
    return out;
  }
  for (const t of pool) out.set(t.name, 1);
  let remaining = count - pool.length;
  let guard = 0;
  while (remaining > 0 && guard++ < 1000) {
    const open = pool.filter((t) => (out.get(t.name) ?? 0) < MAX_PER_TOPIC);
    if (open.length === 0) break;
    const total = open.reduce((a, t) => a + t.weight, 0);
    let r = Math.random() * total;
    let pick = open[0];
    for (const t of open) {
      r -= t.weight;
      if (r <= 0) {
        pick = t;
        break;
      }
    }
    out.set(pick.name, (out.get(pick.name) ?? 0) + 1);
    remaining--;
  }
  return out;
}

export function extractJsonArray(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf("[");
  const end = raw.lastIndexOf("]");
  if (start === -1 || end === -1) throw new Error("la IA no devolvió una lista");
  return JSON.parse(raw.slice(start, end + 1));
}

/** Descarta preguntas mal formadas y mezcla las opciones (la IA tiende a
 * poner la correcta siempre en B o C). */
export function sanitize(raw: unknown, topicByLower: Map<string, string>): Question[] {
  if (!Array.isArray(raw)) return [];
  const out: Question[] = [];
  for (const item of raw as Record<string, unknown>[]) {
    const topicRaw = typeof item.topic === "string" ? item.topic.trim().toLowerCase() : "";
    const topic = topicByLower.get(topicRaw);
    const question = typeof item.question === "string" ? item.question.trim() : "";
    const options = Array.isArray(item.options)
      ? item.options.filter((o): o is string => typeof o === "string" && o.trim() !== "").map((o) => o.trim())
      : [];
    const correct = typeof item.correct === "number" ? Math.trunc(item.correct) : -1;
    const explanation = typeof item.explanation === "string" ? item.explanation.trim() : "";
    if (!topic || !question || options.length !== 4 || correct < 0 || correct > 3) continue;
    if (new Set(options.map((o) => o.toLowerCase())).size !== 4) continue; // opciones repetidas

    const order = shuffle([0, 1, 2, 3]);
    out.push({
      topic,
      question,
      options: order.map((i) => options[i]),
      correct: order.indexOf(correct),
      explanation: explanation.slice(0, 600),
    });
  }
  return out;
}

