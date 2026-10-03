import { describe, it, expect } from "vitest";
import { buildConsolidated, type ConsolidatedData } from "./quizConsolidated";

const ex = (id: string, assignment_id: string, topic: string) => ({
  id, assignment_id, title: `Pregunta ${id}`, topic, deleted_at: null,
});

const data: ConsolidatedData = {
  sessions: [
    { id: "s1", assignment_id: "A" },
    { id: "s2", assignment_id: "A" }, // segunda sesión del mismo quiz
    { id: "s3", assignment_id: "B" },
  ],
  assignments: [{ id: "A", title: "Quiz A" }, { id: "B", title: "Quiz B" }],
  exercises: [ex("a1", "A", "Bucles"), ex("a2", "A", "Bucles"), ex("b1", "B", "Funciones"), ex("b2", "B", "Funciones")],
  roster: [
    { id: "ana", full_name: "Ana", email: null },
    { id: "luis", full_name: "Luis", email: null },
    { id: "eva", full_name: "Eva", email: null },
  ],
  participants: [
    { id: "p1", session_id: "s1", student_id: "ana" },
    { id: "p2", session_id: "s2", student_id: "ana" }, // Ana repitió el quiz A
    { id: "p3", session_id: "s3", student_id: "ana" },
    { id: "p4", session_id: "s1", student_id: "luis" },
    { id: "p5", session_id: "s1", student_id: "profe" }, // no inscrito: se ignora
  ],
  answers: [
    // Ana: falló a1 en la sesión 1 pero la acertó en la 2 -> cuenta como acertada
    { participant_id: "p1", exercise_id: "a1", correct: false },
    { participant_id: "p2", exercise_id: "a1", correct: true },
    { participant_id: "p2", exercise_id: "a2", correct: true },
    { participant_id: "p3", exercise_id: "b1", correct: false },
    { participant_id: "p3", exercise_id: "b2", correct: false },
    // Luis: solo respondió una en el quiz A
    { participant_id: "p4", exercise_id: "a1", correct: true },
    { participant_id: "p5", exercise_id: "a1", correct: true },
  ],
};

describe("buildConsolidated", () => {
  const c = buildConsolidated(data);

  it("toma el mejor intento por pregunta", () => {
    const ana = c.students.find((s) => s.id === "ana")!;
    expect(ana.perQuiz.A).toMatchObject({ correct: 2, answered: 2, pct: 100 });
    expect(ana.perQuiz.B).toMatchObject({ correct: 0, answered: 2, pct: 0 });
    expect(ana.accuracy).toBe(50);
  });

  it("detecta falencias por tema y preguntas falladas", () => {
    const ana = c.students.find((s) => s.id === "ana")!;
    expect(ana.weaknesses.map((t) => t.topic)).toEqual(["Funciones"]);
    expect(ana.strengths.map((t) => t.topic)).toEqual(["Bucles"]);
    expect(ana.missed).toHaveLength(2);
  });

  it("no penaliza lo no respondido y marca quién no participó", () => {
    const luis = c.students.find((s) => s.id === "luis")!;
    expect(luis.accuracy).toBe(100);
    expect(luis.unanswered).toBe(1);
    expect(luis.perQuiz.B).toBeNull();
    expect(c.absent.map((a) => a.name)).toEqual(["Eva"]);
  });

  it("ignora participantes que no están inscritos", () => {
    expect(c.students.map((s) => s.id)).not.toContain("profe");
  });
});
