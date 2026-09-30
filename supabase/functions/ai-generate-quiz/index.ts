// Supabase Edge Function: ai-generate-quiz
// Genera un LOTE de preguntas de opción múltiple (tema + dificultad + cuántas)
// para armar un quiz de una sola vez, en vez de crear cada pregunta a mano.
// Reutiliza el secreto OPENROUTER_API_KEY y la tabla ai_usage (rate limit)
// que ya usan ai-review/ai-generate.
//
//   supabase functions deploy ai-generate-quiz
// (no necesita secretos nuevos)

import { createClient } from "jsr:@supabase/supabase-js@2";

const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY")!;
const OPENROUTER_MODEL =
  Deno.env.get("OPENROUTER_MODEL") ?? "anthropic/claude-3.5-sonnet";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const DIFF_LABEL: Record<string, string> = {
  beginner: "principiante (muy básico, primeros pasos)",
  easy: "fácil (conceptos básicos)",
  medium: "medio (requiere combinar varios conceptos)",
  hard: "difícil (a fondo, casos menos obvios)",
};

const MAX_COUNT = 20;

interface RawQuestion {
  title?: unknown;
  prompt?: unknown;
  options?: unknown;
  correct?: unknown;
}
interface Question {
  title: string;
  prompt: string;
  options: string[];
  correct: number;
}

function extractJsonArray(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf("[");
  const end = raw.lastIndexOf("]");
  if (start === -1 || end === -1) throw new Error("la IA no devolvió una lista");
  return JSON.parse(raw.slice(start, end + 1));
}

/** Descarta preguntas mal formadas en vez de fallar todo el lote por una sola. */
function sanitizeQuestions(raw: unknown, limit: number): Question[] {
  if (!Array.isArray(raw)) return [];
  const out: Question[] = [];
  for (const item of raw as RawQuestion[]) {
    const title = typeof item.title === "string" ? item.title.trim() : "";
    const prompt = typeof item.prompt === "string" ? item.prompt.trim() : "";
    const options = Array.isArray(item.options)
      ? item.options.filter((o): o is string => typeof o === "string" && o.trim() !== "")
      : [];
    const correct = typeof item.correct === "number" ? Math.trunc(item.correct) : -1;
    if (title && prompt && options.length === 4 && correct >= 0 && correct <= 3) {
      out.push({ title, prompt, options, correct });
    }
    if (out.length >= limit) break;
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const authHeader = req.headers.get("Authorization") ?? "";
    const caller = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await caller.auth.getUser();
    const uid = userData?.user?.id;
    if (userErr || !uid) throw new Error("No autenticado");

    const { topic, count, difficulty, subjectHint } = await req.json();
    if (!topic || typeof topic !== "string" || !topic.trim()) {
      throw new Error("Escribe sobre qué tema quieres las preguntas.");
    }
    if (!DIFF_LABEL[difficulty]) throw new Error("Dificultad no válida.");
    const wanted = Math.max(1, Math.min(MAX_COUNT, Math.trunc(Number(count) || 0)));

    const admin = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // ---- Rate limit (mismo esquema que ai-review: protege el costo) ----
    const now = Date.now();
    const { count: perMin } = await admin
      .from("ai_usage")
      .select("id", { count: "exact", head: true })
      .eq("student_id", uid)
      .gte("created_at", new Date(now - 60_000).toISOString());
    if ((perMin ?? 0) >= 3) {
      throw new Error("Vas muy rápido. Espera un momento antes de generar otro lote.");
    }
    const { count: perHour } = await admin
      .from("ai_usage")
      .select("id", { count: "exact", head: true })
      .eq("student_id", uid)
      .gte("created_at", new Date(now - 3_600_000).toISOString());
    if ((perHour ?? 0) >= 10) {
      throw new Error("Alcanzaste el límite de lotes generados por hora. Intenta más tarde.");
    }
    await admin.from("ai_usage").insert({ student_id: uid });
    // ---------------------------------------------------------------

    const subjectContext =
      typeof subjectHint === "string" && subjectHint.trim()
        ? ` para un curso de "${subjectHint.trim()}"`
        : "";
    const prompt = `Eres un profesor universitario diseñando un quiz de opción múltiple${subjectContext}.
Genera exactamente ${wanted} preguntas de opción múltiple ORIGINALES y variadas
sobre el tema: "${topic.trim()}", de dificultad ${DIFF_LABEL[difficulty]}.

Reglas:
- Todo el texto (títulos, enunciados y opciones) debe estar en ESPAÑOL,
  sin importar el idioma del tema.
- Cada pregunta debe tener EXACTAMENTE 4 opciones, todas creíbles (nada de
  opciones obviamente absurdas), y solo UNA correcta.
- No repitas la misma pregunta ni la reformules apenas.
- Las preguntas deben poder responderse sin necesitar una imagen.

Responde ÚNICAMENTE con un JSON válido (sin markdown, sin texto extra): un
arreglo con esta forma exacta, sin ningún otro campo:
[
  {
    "title": "<título corto de la pregunta, en español>",
    "prompt": "<el enunciado completo de la pregunta, en español>",
    "options": ["<opción A>", "<opción B>", "<opción C>", "<opción D>"],
    "correct": <índice 0, 1, 2 o 3 de la opción correcta>
  }
]`;

    async function callModel(): Promise<Question[]> {
      const aiRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://plataforma-tutoria.vercel.app",
          "X-Title": "Kodea",
        },
        body: JSON.stringify({
          model: OPENROUTER_MODEL,
          temperature: 0.7,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      if (!aiRes.ok) {
        throw new Error(`OpenRouter ${aiRes.status}: ${await aiRes.text()}`);
      }
      const completion = await aiRes.json();
      const content: string = completion.choices?.[0]?.message?.content ?? "";
      if (!content.trim()) throw new Error("respuesta vacía del modelo");
      const questions = sanitizeQuestions(extractJsonArray(content), wanted);
      if (questions.length === 0) throw new Error("la IA no devolvió preguntas usables");
      return questions;
    }

    let questions: Question[] = [];
    let lastErr = "";
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        questions = await callModel();
        break;
      } catch (e) {
        lastErr = e instanceof Error ? e.message : String(e);
        if (attempt === 3) {
          throw new Error(
            `La IA no pudo generar las preguntas (reintenta en unos segundos). Detalle: ${lastErr}`,
          );
        }
      }
    }

    return new Response(JSON.stringify({ ok: true, questions }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
