import { describe, it, expect } from "vitest";
import { parseQuizText } from "./quizPaste";

describe("parseQuizText", () => {
  it("lee preguntas numeradas con opciones a) b) c) y la correcta marcada con *", () => {
    const r = parseQuizText(`1. ¿Capital de Francia?
a) Madrid
b) París *
c) Roma
d) Berlín

2. ¿Cuánto es 2+2?
a) 3
b) 4 ✓
c) 5`);
    expect(r.questions).toHaveLength(2);
    expect(r.questions[0]).toEqual({
      question: "¿Capital de Francia?",
      options: ["Madrid", "París", "Roma", "Berlín"],
      correct: 1,
    });
    expect(r.questions[1].options).toEqual(["3", "4", "5"]);
    expect(r.questions[1].correct).toBe(1);
    expect(r.warnings).toEqual([]);
  });

  it("entiende la línea 'Respuesta: C' y también el texto de la respuesta", () => {
    const r = parseQuizText(`1) Mayor planeta
A. Marte
B. Tierra
C. Júpiter
Respuesta: C

2) Color del cielo
A. Rojo
B. Azul
Rta: azul`);
    expect(r.questions[0].correct).toBe(2);
    expect(r.questions[1].correct).toBe(1);
  });

  it("separa preguntas sin numerar por línea en blanco y acepta viñetas", () => {
    const r = parseQuizText(`¿Qué es HTML?
- Un lenguaje de marcado *
- Una base de datos

¿Qué es CSS?
- Estilos
- Un servidor`);
    expect(r.questions).toHaveLength(2);
    expect(r.questions[0].correct).toBe(0);
    expect(r.questions[1].correct).toBeNull(); // no se indicó: el tutor la elige
  });

  it("junta preguntas que ocupan varias líneas", () => {
    const r = parseQuizText(`1. Si un tren sale a las 8:00
y viaja 3 horas, ¿a qué hora llega?
a) 10:00
b) 11:00 (correcta)`);
    expect(r.questions[0].question).toBe("Si un tren sale a las 8:00 y viaja 3 horas, ¿a qué hora llega?");
    expect(r.questions[0].correct).toBe(1);
  });

  it("avisa de bloques sin opciones y de marcas repetidas", () => {
    const r = parseQuizText(`1. Esto no tiene opciones

2. Pregunta doble marca
a) uno *
b) dos *`);
    expect(r.questions).toHaveLength(1);
    expect(r.questions[0].correct).toBe(0);
    expect(r.warnings.join(" ")).toMatch(/más de una respuesta/);
    expect(r.warnings.join(" ")).toMatch(/se omitió/);
  });

  it("tolera Windows (\\r\\n), espacios y mayúsculas raras", () => {
    const r = parseQuizText("PREGUNTA 1: ¿Sí?\r\n  A) Sí  *\r\n  B) No\r\n");
    expect(r.questions).toHaveLength(1);
    expect(r.questions[0]).toMatchObject({ question: "¿Sí?", options: ["Sí", "No"], correct: 0 });
  });

  it("texto vacío o sin preguntas no inventa nada", () => {
    expect(parseQuizText("").questions).toEqual([]);
    expect(parseQuizText("hola\n\nsolo texto").questions).toEqual([]);
  });
});
