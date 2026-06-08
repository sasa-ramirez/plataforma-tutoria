// Supabase Edge Function: ai-generate
// Genera un ejercicio de práctica (título + enunciado + solución de referencia)
// según lenguaje, dificultad y tema. Reutiliza el secreto OPENROUTER_API_KEY.
//
//   supabase functions deploy ai-generate
// (no necesita secretos nuevos; usa los de ai-review)

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

const DIFF_LABEL: Record<string, string> = {
  beginner: "principiante (muy básico, primeros pasos)",
  easy: "fácil (conceptos básicos)",
  medium: "medio (requiere combinar varios conceptos)",
  hard: "difícil (resolución de problemas, eficiencia)",
};

function extractJson(text: string): unknown {
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
    const { language, difficulty, topic, avoid } = await req.json();
    if (!language || !difficulty) {
      throw new Error("language y difficulty son obligatorios");
    }

    const avoidList: string[] = Array.isArray(avoid) ? avoid.slice(0, 20) : [];
    const avoidText =
      avoidList.length > 0
        ? `\n\nNO repitas ni te parezcas a estos ejercicios que el estudiante YA hizo (cambia el enunciado, el contexto y los datos):\n- ${avoidList.join("\n- ")}`
        : "";
    // Semilla aleatoria para forzar variedad entre generaciones.
    const seed = Math.random().toString(36).slice(2, 8);

    const prompt = `Eres un profesor de programación para estudiantes universitarios principiantes.
Genera UN ejercicio de práctica ORIGINAL y variado en ${LANG_LABEL[language] ?? language}, de dificultad ${DIFF_LABEL[difficulty] ?? difficulty}${
      topic ? `, sobre el tema: "${topic}"` : ""
    }. Usa un contexto/escenario creativo y distinto cada vez (variación #${seed}).${avoidText}

Responde ÚNICAMENTE con un JSON válido (sin markdown, sin texto extra) con esta forma exacta:
{
  "title": "<título corto y claro>",
  "prompt": "<enunciado claro en español; incluye un ejemplo de entrada y salida esperada cuando aplique>",
  "solution_code": "<una solución de referencia COMPLETA y correcta en ${LANG_LABEL[language] ?? language}>"
}
El enunciado debe ser apropiado para la dificultad indicada y autocontenido.`;

    async function callModel() {
      const aiRes = await fetch(
        "https://openrouter.ai/api/v1/chat/completions",
        {
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
        },
      );
      if (!aiRes.ok) {
        throw new Error(`OpenRouter ${aiRes.status}: ${await aiRes.text()}`);
      }
      const completion = await aiRes.json();
      const content: string = completion.choices?.[0]?.message?.content ?? "";
      if (!content.trim()) throw new Error("respuesta vacía del modelo");
      // deno-lint-ignore no-explicit-any
      return extractJson(content) as any;
    }

    // deno-lint-ignore no-explicit-any
    let parsed: any;
    let lastErr = "";
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        parsed = await callModel();
        break;
      } catch (e) {
        lastErr = e instanceof Error ? e.message : String(e);
        if (attempt === 3) {
          throw new Error(
            `La IA no pudo generar el ejercicio (reintenta en unos segundos). Detalle: ${lastErr}`,
          );
        }
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        title: parsed.title ?? "Ejercicio de práctica",
        prompt: parsed.prompt ?? "",
        solution_code: parsed.solution_code ?? null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
