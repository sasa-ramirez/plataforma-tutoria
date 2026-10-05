// Llamada a OpenRouter pensada para modelos GRATUITOS / de "razonamiento".
//
// Problema real: los modelos gratuitos de hoy casi todos "piensan" antes de
// contestar y ese pensamiento gasta el MISMO tope de salida (max_tokens). Si
// se agota pensando, la respuesta llega con finish_reason "length" y el
// contenido VACÍO. Esta función lo maneja con una escalera de intentos:
//   1) sin razonamiento (reasoning.enabled=false)         → rápido, si el modelo lo permite
//   2) razonamiento mínimo + tope de salida mayor          → para los que no se pueden apagar
//   3) mismo proceso con el siguiente modelo de respaldo
// y devuelve un diagnóstico legible si nada funciona.
// Sin Deno ni librerías: se puede probar con vitest simulando fetch.

export interface ChatRequest {
  apiKey: string;
  /** En orden de preferencia: el primero que dé una respuesta útil gana. */
  models: string[];
  prompt: string;
  temperature?: number;
  /** Tope de salida visible deseado; con razonamiento se multiplica. */
  maxTokens: number;
  /** Tiempo máximo por llamada. */
  callTimeoutMs: number;
  /** Instante (Date.now()) a partir del cual ya no se inicia otra llamada. */
  deadline: number;
  fetchImpl?: typeof fetch;
}

export interface ChatResult {
  content: string;
  model: string;
}

interface Variant {
  label: string;
  reasoning: Record<string, unknown>;
  tokens: (base: number) => number;
}

const VARIANTS: Variant[] = [
  { label: "sin razonar", reasoning: { enabled: false }, tokens: (b) => b },
  { label: "razonamiento mínimo", reasoning: { effort: "minimal" }, tokens: (b) => Math.min(12_000, b * 3) },
];

/** Texto de la respuesta: acepta string o la lista de "partes" que usan algunos proveedores. */
export function messageText(message: unknown): string {
  const m = message as { content?: unknown; reasoning?: unknown; reasoning_content?: unknown } | undefined;
  const c = m?.content;
  if (typeof c === "string") return c;
  if (Array.isArray(c)) {
    return c
      .map((p) => (typeof p === "string" ? p : typeof (p as { text?: unknown })?.text === "string" ? (p as { text: string }).text : ""))
      .join("");
  }
  return "";
}

/** Último recurso: algunos modelos dejan la respuesta dentro del "razonamiento". */
export function reasoningText(message: unknown): string {
  const m = message as { reasoning?: unknown; reasoning_content?: unknown } | undefined;
  const r = m?.reasoning ?? m?.reasoning_content;
  return typeof r === "string" ? r : "";
}

export async function chatJson(req: ChatRequest): Promise<ChatResult> {
  const doFetch = req.fetchImpl ?? fetch;
  const notes: string[] = [];

  for (const model of req.models) {
    for (const variant of VARIANTS) {
      const left = req.deadline - Date.now();
      if (left < 5_000) {
        notes.push("se acabó el tiempo");
        throw new Error(`La IA no alcanzó a responder a tiempo (${notes.join(" | ")}).`);
      }
      const tag = `${model} ${variant.label}`;
      let res: Response;
      try {
        res = await doFetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          signal: AbortSignal.timeout(Math.min(req.callTimeoutMs, left)),
          headers: {
            Authorization: `Bearer ${req.apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://plataforma-tutoria.vercel.app",
            "X-Title": "Kodea",
          },
          body: JSON.stringify({
            model,
            temperature: req.temperature ?? 0.3,
            max_tokens: variant.tokens(req.maxTokens),
            reasoning: variant.reasoning,
            messages: [{ role: "user", content: req.prompt }],
          }),
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        notes.push(`${tag}: ${/timeout|abort/i.test(msg) ? "tardó demasiado" : msg.slice(0, 80)}`);
        break; // un modelo lento no mejora con la otra variante: pasar al siguiente
      }

      if (!res.ok) {
        const body = (await res.text()).slice(0, 200);
        // El modelo no admite apagar el razonamiento → probar la variante siguiente.
        if ((res.status === 400 || res.status === 422) && /reasoning/i.test(body)) {
          notes.push(`${tag}: no admite ese modo`);
          continue;
        }
        notes.push(`${tag}: HTTP ${res.status}`);
        break; // límite de uso, caído, etc.: otro modelo
      }

      const data = await res.json().catch(() => null);
      const choice = data?.choices?.[0];
      // OpenRouter a veces responde 200 con el error dentro del cuerpo.
      if (!choice && data?.error) {
        notes.push(`${tag}: ${String(data.error?.message ?? "error").slice(0, 80)}`);
        break;
      }
      const text = messageText(choice?.message);
      if (text.trim()) return { content: text, model };

      const fallback = reasoningText(choice?.message);
      if (fallback.includes("[") && fallback.includes("]")) return { content: fallback, model };

      const rt = data?.usage?.completion_tokens_details?.reasoning_tokens;
      notes.push(
        `${tag}: respuesta vacía (${choice?.finish_reason ?? "?"}${rt ? `, razonó ${rt} tokens` : ""})`,
      );
      // vacía por agotar el tope pensando → la variante siguiente da más margen
    }
  }
  throw new Error(`La IA no dio una respuesta útil: ${notes.join(" | ")}`);
}

/** Lista de modelos: el configurado primero y luego los de respaldo (sin repetir). */
export function modelChain(primary: string, fallbacks: string | undefined): string[] {
  const extra = (fallbacks ?? "openrouter/free")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return [...new Set([primary, ...extra])];
}
