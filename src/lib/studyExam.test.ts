import { describe, it, expect } from "vitest";
import { allocate, sanitize, extractJsonArray, norm } from "../../supabase/functions/_shared/studyExam";

const topics = (n: number) => Array.from({ length: n }, (_, i) => ({ name: `Tema ${i + 1}`, weight: 1 + (i % 3) }));
const sum = (m: Map<string, number>) => [...m.values()].reduce((a, b) => a + b, 0);

describe("allocate", () => {
  it("cubre todos los temas cuando alcanzan las preguntas", () => {
    for (let k = 0; k < 20; k++) {
      const plan = allocate(topics(6), 20);
      expect(plan.size).toBe(6);
      expect(sum(plan)).toBe(20);
      for (const n of plan.values()) expect(n).toBeGreaterThanOrEqual(1);
    }
  });

  it("con más temas que preguntas elige temas distintos, una pregunta cada uno", () => {
    const plan = allocate(topics(12), 5);
    expect(plan.size).toBe(5);
    expect(sum(plan)).toBe(5);
    for (const n of plan.values()) expect(n).toBe(1);
  });

  it("no pasa del tope por tema aunque haya pocos temas", () => {
    const plan = allocate(topics(2), 30);
    for (const n of plan.values()) expect(n).toBeLessThanOrEqual(5);
    expect(sum(plan)).toBe(10);
  });
});

describe("sanitize", () => {
  const map = new Map([["limites", "Límites"]]);
  const q = (over: Record<string, unknown> = {}) => ({
    topic: "límites".normalize("NFD").replace(/[̀-ͯ]/g, ""),
    question: "¿Qué es un límite?",
    options: ["a", "b", "c", "d"],
    correct: 2,
    explanation: "porque sí",
    ...over,
  });

  it("acepta preguntas válidas, mapea el tema y conserva la correcta tras mezclar", () => {
    for (let k = 0; k < 30; k++) {
      const out = sanitize([q()], map);
      expect(out).toHaveLength(1);
      expect(out[0].topic).toBe("Límites");
      expect(out[0].options[out[0].correct]).toBe("c");
      expect([...out[0].options].sort()).toEqual(["a", "b", "c", "d"]);
    }
  });

  it("descarta tema inventado, opciones repetidas o fuera de rango", () => {
    expect(sanitize([q({ topic: "otro tema" })], map)).toHaveLength(0);
    expect(sanitize([q({ options: ["a", "a", "b", "c"] })], map)).toHaveLength(0);
    expect(sanitize([q({ options: ["a", "b", "c"] })], map)).toHaveLength(0);
    expect(sanitize([q({ correct: 4 })], map)).toHaveLength(0);
    expect(sanitize([q({ question: "" })], map)).toHaveLength(0);
    expect(sanitize("no es lista", map)).toHaveLength(0);
  });
});

describe("sanitize: resolución del tema", () => {
  const byNorm = new Map([
    ["limites y continuidad", "Límites y Continuidad"],
    ["derivadas", "Derivadas"],
  ]);
  const byId = new Map([[1, "Límites y Continuidad"], [2, "Derivadas"]]);
  const base = { question: "¿?", options: ["a", "b", "c", "d"], correct: 0, explanation: "x" };

  it("prefiere el número de tema", () => {
    const out = sanitize([{ ...base, tema: 2 }], byNorm, byId);
    expect(out[0].topic).toBe("Derivadas");
  });

  it("acepta el número como texto", () => {
    expect(sanitize([{ ...base, tema: "1" }], byNorm, byId)[0].topic).toBe("Límites y Continuidad");
  });

  it("tolera tildes, mayúsculas y nombres parciales cuando no hay número", () => {
    expect(sanitize([{ ...base, topic: "LIMITES Y CONTINUIDAD" }], byNorm)[0].topic).toBe("Límites y Continuidad");
    expect(sanitize([{ ...base, topic: "Derivadas (regla de la cadena)" }], byNorm)[0].topic).toBe("Derivadas");
  });

  it("descarta si no hay forma de ubicar el tema", () => {
    expect(sanitize([{ ...base, tema: 9 }], byNorm, byId)).toHaveLength(0);
    expect(sanitize([{ ...base, topic: "Química" }], byNorm)).toHaveLength(0);
  });

  it("norm quita tildes y espacios dobles", () => {
    expect(norm("  Límites   de  Funciones ")).toBe("limites de funciones");
  });
});

describe("extractJsonArray", () => {
  it("saca el arreglo aunque venga envuelto en markdown", () => {
    expect(extractJsonArray('```json\n[{"a":1}]\n```')).toEqual([{ a: 1 }]);
    expect(extractJsonArray('Aquí va: [1,2]')).toEqual([1, 2]);
    expect(() => extractJsonArray("nada")).toThrow();
  });
});
