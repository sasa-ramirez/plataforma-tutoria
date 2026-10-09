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

describe("texto pegado desde Word", () => {
  it("lee una pregunta con código y líneas en blanco entre cada opción", () => {
    const r = parseQuizText(`1. ¿Qué imprime el siguiente código?
int contador = 0;
for (int i = 0; i < 2; i++) {
    contador++;
}
System.out.println(contador);

A. 2*

B. 3

C. 4

D. 5`);
    expect(r.questions).toHaveLength(1);
    const q = r.questions[0];
    expect(q.options).toEqual(["2", "3", "4", "5"]);
    expect(q.correct).toBe(0);
    // el código conserva sus saltos de línea y la sangría
    expect(q.question).toContain(
      ["int contador = 0;", "for (int i = 0; i < 2; i++) {", "    contador++;", "}", "System.out.println(contador);"].join("\n"),
    );
    expect(r.warnings).toEqual([]);
  });

  it("varias preguntas con espacios de Word entre todo", () => {
    const r = parseQuizText(`1. Primera pregunta

A. uno

B. dos *


2. Segunda pregunta

A. tres *

B. cuatro

Respuesta: A`);
    expect(r.questions).toHaveLength(2);
    expect(r.questions[0]).toMatchObject({ options: ["uno", "dos"], correct: 1 });
    expect(r.questions[1]).toMatchObject({ options: ["tres", "cuatro"], correct: 0 });
  });

  it("pregunta sin numerar tras opciones separadas por blancos abre una nueva", () => {
    const r = parseQuizText(`¿Primera?

a) x *

b) y

¿Segunda?

a) z

b) w *`);
    expect(r.questions.map((q) => q.question)).toEqual(["¿Primera?", "¿Segunda?"]);
    expect(r.questions[1].correct).toBe(1);
  });
});
