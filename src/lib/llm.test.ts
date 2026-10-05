import { describe, it, expect } from "vitest";
import { chatJson, messageText, modelChain } from "../../supabase/functions/_shared/llm";

type Reply = { status?: number; body: unknown };

/** fetch falso: devuelve las respuestas en orden y guarda lo que se le pidió. */
function fakeFetch(replies: Reply[]) {
  const calls: { model: string; reasoning: unknown; max_tokens: number }[] = [];
  const impl = (async (_url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body));
    calls.push({ model: body.model, reasoning: body.reasoning, max_tokens: body.max_tokens });
    const r = replies.shift() ?? { status: 500, body: "sin más respuestas" };
    const text = typeof r.body === "string" ? r.body : JSON.stringify(r.body);
    return new Response(text, { status: r.status ?? 200 });
  }) as unknown as typeof fetch;
  return { impl, calls };
}

const ok = (content: unknown) => ({ body: { choices: [{ message: { content }, finish_reason: "stop" }] } });
const empty = (reasoningTokens = 1500) => ({
  body: {
    choices: [{ message: { content: "" }, finish_reason: "length" }],
    usage: { completion_tokens_details: { reasoning_tokens: reasoningTokens } },
  },
});

const base = {
  apiKey: "k",
  prompt: "hola",
  maxTokens: 1000,
  callTimeoutMs: 5000,
  deadline: Date.now() + 60_000,
};

describe("chatJson", () => {
  it("responde a la primera si el modelo contesta sin razonar", async () => {
    const f = fakeFetch([ok("[1]")]);
    const r = await chatJson({ ...base, models: ["m1"], fetchImpl: f.impl });
    expect(r.content).toBe("[1]");
    expect(f.calls).toHaveLength(1);
    expect(f.calls[0].reasoning).toEqual({ enabled: false });
  });

  it("si llega vacía por agotar el tope pensando, reintenta con razonamiento mínimo y más margen", async () => {
    const f = fakeFetch([empty(), ok("[2]")]);
    const r = await chatJson({ ...base, models: ["m1"], fetchImpl: f.impl });
    expect(r.content).toBe("[2]");
    expect(f.calls[1].reasoning).toEqual({ effort: "minimal" });
    expect(f.calls[1].max_tokens).toBeGreaterThan(f.calls[0].max_tokens);
  });

  it("si el modelo rechaza apagar el razonamiento (400), prueba el otro modo", async () => {
    const f = fakeFetch([{ status: 400, body: "reasoning is mandatory for this model" }, ok("[3]")]);
    const r = await chatJson({ ...base, models: ["m1"], fetchImpl: f.impl });
    expect(r.content).toBe("[3]");
    expect(f.calls).toHaveLength(2);
  });

  it("si un modelo está limitado (429) o caído, pasa al siguiente", async () => {
    const f = fakeFetch([{ status: 429, body: "rate limited" }, ok("[4]")]);
    const r = await chatJson({ ...base, models: ["m1", "m2"], fetchImpl: f.impl });
    expect(r.model).toBe("m2");
    expect(f.calls.map((c) => c.model)).toEqual(["m1", "m2"]);
  });

  it("acepta el contenido como lista de partes", async () => {
    const f = fakeFetch([ok([{ type: "text", text: "[" }, { type: "text", text: "5]" }])]);
    const r = await chatJson({ ...base, models: ["m1"], fetchImpl: f.impl });
    expect(r.content).toBe("[5]");
  });

  it("rescata una lista que el modelo dejó dentro de su razonamiento", async () => {
    const f = fakeFetch([
      { body: { choices: [{ message: { content: "", reasoning: 'pienso... [{"a":1}]' }, finish_reason: "stop" }] } },
    ]);
    const r = await chatJson({ ...base, models: ["m1"], fetchImpl: f.impl });
    expect(r.content).toContain('[{"a":1}]');
  });

  it("detecta el error que OpenRouter manda dentro de un 200", async () => {
    const f = fakeFetch([{ body: { error: { message: "provider down" } } }, ok("[6]")]);
    const r = await chatJson({ ...base, models: ["m1", "m2"], fetchImpl: f.impl });
    expect(r.model).toBe("m2");
  });

  it("si nada funciona, el error explica qué pasó con cada intento", async () => {
    const f = fakeFetch([empty(2900), empty(4000), { status: 503, body: "caído" }]);
    await expect(chatJson({ ...base, models: ["m1", "m2"], fetchImpl: f.impl })).rejects.toThrow(
      /m1 sin razonar: respuesta vacía \(length, razonó 2900 tokens\).*m2.*HTTP 503/s,
    );
  });

  it("no inicia otra llamada cuando ya se acabó el tiempo", async () => {
    const f = fakeFetch([ok("[7]")]);
    await expect(
      chatJson({ ...base, models: ["m1"], deadline: Date.now() + 1000, fetchImpl: f.impl }),
    ).rejects.toThrow(/a tiempo/);
    expect(f.calls).toHaveLength(0);
  });
});

describe("helpers", () => {
  it("messageText tolera formatos raros", () => {
    expect(messageText(undefined)).toBe("");
    expect(messageText({ content: null })).toBe("");
    expect(messageText({ content: "x" })).toBe("x");
  });

  it("modelChain pone el configurado primero, agrega respaldo y no repite", () => {
    expect(modelChain("a", undefined)).toEqual(["a", "openrouter/free"]);
    expect(modelChain("openrouter/free", undefined)).toEqual(["openrouter/free"]);
    expect(modelChain("a", "b, c ,a")).toEqual(["a", "b", "c"]);
  });
});
