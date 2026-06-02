// Supabase Edge Function: ai-review
// Revisa una submission con OpenRouter y guarda ai_feedback.
// La API key vive en secretos del proyecto, NUNCA en el cliente.
//
//   supabase functions deploy ai-review
//   supabase secrets set OPENROUTER_API_KEY=sk-or-...
//
// El cliente la invoca con: supabase.functions.invoke('ai-review', { body: { submission_id } })

import { createClient } from "jsr:@supabase/supabase-js@2";

const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY")!;
const OPENROUTER_MODEL =
  Deno.env.get("OPENROUTER_MODEL") ?? "anthropic/claude-3.5-sonnet";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const LANG_LABEL: Record<string, string> = {
  pseint: "PSeInt (pseudocódigo en español)",
  java: "Java",
  python: "Python",
  logic: "lógica / pseudocódigo",
};

function buildPrompt(opts: {
  language: string;
  prompt: string;
  code: string;
  solution?: string | null;
}) {
  return `Eres un tutor de programación amable y motivador para estudiantes universitarios principiantes.
Evalúa el siguiente código escrito en ${LANG_LABEL[opts.language] ?? opts.language}.

ENUNCIADO DEL EJERCICIO:
${opts.prompt}

${opts.solution ? `SOLUCIÓN DE REFERENCIA (no la reveles literalmente):\n${opts.solution}\n` : ""}
CÓDIGO DEL ESTUDIANTE:
\`\`\`
${opts.code}
\`\`\`

Responde ÚNICAMENTE con un JSON válido (sin markdown, sin texto extra) con esta forma exacta:
{
  "score": <entero 1-100>,
  "summary": "<2-3 frases de feedback cálido y claro en español>",
  "errors": [{"line": <número o null>, "message": "<qué falla y por qué>", "severity": "error|warning|info"}],
  "suggestions": ["<mejora concreta>", "..."],
  "strengths": ["<algo que hizo bien>", "..."]
}
Sé honesto pero motivador. Explica los errores de forma sencilla.`;
}

function extractJson(text: string): unknown {
  // Tolerante a ```json ... ``` o texto alrededor.
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  return JSON.parse(raw.slice(start, end + 1));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { submission_id } = await req.json();
    if (!submission_id) throw new Error("submission_id requerido");

    // Cliente con service-role para poder escribir ai_feedback (bypassa RLS).
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Trae submission + ejercicio
    const { data: sub, error: subErr } = await admin
      .from("submissions")
      .select(
        "id, code, language, exercise_id, student_id, exercises(prompt, solution_code)",
      )
      .eq("id", submission_id)
      .single();
    if (subErr || !sub) throw new Error("Submission no encontrada");

    // ---- Rate limit por estudiante (protege tu costo de IA) ----
    const sid = sub.student_id as string;
    const now = Date.now();
    const { count: perMin } = await admin
      .from("ai_usage")
      .select("id", { count: "exact", head: true })
      .eq("student_id", sid)
      .gte("created_at", new Date(now - 60_000).toISOString());
    if ((perMin ?? 0) >= 5) {
      throw new Error("Vas muy rápido. Espera unos segundos antes de reenviar.");
    }
    const { count: perHour } = await admin
      .from("ai_usage")
      .select("id", { count: "exact", head: true })
      .eq("student_id", sid)
      .gte("created_at", new Date(now - 3_600_000).toISOString());
    if ((perHour ?? 0) >= 30) {
      throw new Error(
        "Alcanzaste el límite de revisiones por hora. Intenta más tarde.",
      );
    }
    await admin.from("ai_usage").insert({ student_id: sid });
    // ------------------------------------------------------------

    await admin
      .from("submissions")
      .update({ status: "grading" })
      .eq("id", submission_id);

    // deno-lint-ignore no-explicit-any
    const exercise = (sub as any).exercises;

    const prompt = buildPrompt({
      language: sub.language,
      prompt: exercise?.prompt ?? "",
      code: sub.code,
      solution: exercise?.solution_code,
    });

    // Una llamada al modelo. Lanza si la respuesta viene vacía o no parsea.
    async function callModel() {
      const aiRes = await fetch(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${OPENROUTER_API_KEY}`,
            "Content-Type": "application/json",
            // Recomendado por OpenRouter (mejora acceso a algunos modelos)
            "HTTP-Referer": "https://plataforma-tutoria.vercel.app",
            "X-Title": "Kodea",
          },
          body: JSON.stringify({
            model: OPENROUTER_MODEL,
            temperature: 0.2,
            messages: [{ role: "user", content: prompt }],
          }),
        },
      );
      if (!aiRes.ok) {
        throw new Error(`OpenRouter ${aiRes.status}: ${await aiRes.text()}`);
      }
      const completion = await aiRes.json();
      const content: string =
        completion.choices?.[0]?.message?.content ?? "";
      if (!content.trim()) throw new Error("respuesta vacía del modelo");
      // deno-lint-ignore no-explicit-any
      return { completion, parsed: extractJson(content) as any };
    }

    // Reintento: los modelos gratis a veces devuelven vacío.
    let completion: unknown;
    // deno-lint-ignore no-explicit-any
    let parsed: any;
    let lastErr = "";
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const r = await callModel();
        completion = r.completion;
        parsed = r.parsed;
        break;
      } catch (e) {
        lastErr = e instanceof Error ? e.message : String(e);
        if (attempt === 3) {
          throw new Error(
            `La IA no devolvió una respuesta válida (el modelo gratis puede estar saturado). Reintenta en unos segundos. Detalle: ${lastErr}`,
          );
        }
      }
    }

    const score = Math.max(1, Math.min(100, Math.round(parsed.score ?? 0)));

    await admin.from("ai_feedback").upsert(
      {
        submission_id,
        score,
        summary: parsed.summary ?? null,
        errors: parsed.errors ?? [],
        suggestions: parsed.suggestions ?? [],
        strengths: parsed.strengths ?? [],
        model: OPENROUTER_MODEL,
        raw: completion,
      },
      { onConflict: "submission_id" },
    );

    await admin
      .from("submissions")
      .update({ status: "graded", score })
      .eq("id", submission_id);

    return new Response(JSON.stringify({ ok: true, score, feedback: parsed }), {
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
