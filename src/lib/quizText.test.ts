import { describe, it, expect } from "vitest";
import { splitQuestion, titleFromQuestion } from "./quizText";

describe("splitQuestion", () => {
  it("pregunta de IA: título corto + enunciado, se muestran los dos", () => {
    expect(splitQuestion({ title: "Capital", prompt: "¿Cuál es la capital de Francia?" })).toEqual({
      heading: "Capital",
      body: "¿Cuál es la capital de Francia?",
    });
  });

  it("pregunta manual corta: título = pregunta, sin enunciado → una sola vez", () => {
    expect(splitQuestion({ title: "¿Qué es HTML?", prompt: "" })).toEqual({ heading: null, body: "¿Qué es HTML?" });
    expect(splitQuestion({ title: "¿Qué es HTML?", prompt: "¿Qué es HTML?" })).toEqual({
      heading: null,
      body: "¿Qué es HTML?",
    });
  });

  it("pregunta manual larga: título recortado con … y enunciado completo → solo el enunciado", () => {
    const q = "Un tren sale de la estación a las 8:00 y viaja a velocidad constante durante tres horas completas, ¿a qué hora llega?";
    const title = titleFromQuestion(q, 60);
    expect(title.endsWith("…")).toBe(true);
    expect(splitQuestion({ title, prompt: q })).toEqual({ heading: null, body: q });
  });
});

describe("titleFromQuestion", () => {
  it("no recorta lo corto y junta espacios", () => {
    expect(titleFromQuestion("  ¿Hola   mundo? ")).toBe("¿Hola mundo?");
  });
});
