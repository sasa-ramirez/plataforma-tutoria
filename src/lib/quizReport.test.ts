import { describe, it, expect } from "vitest";
import { buildReport, reportToCsv } from "./quizReport";
import { isExpired, localDateTimeInput } from "./quizSession";
import type { QuizReport } from "@/services/quiz";

const report: QuizReport = {
  assignment: { id: "a", title: "Tarea abierta", course_name: "Curso" },
  questions: [
    { id: "q1", title: "Q1" },
    { id: "q2", title: "Q2" },
  ],
  roster: [
    { id: "ana", full_name: "Ana", email: "ana@x" },
    { id: "luis", full_name: "Luis", email: "luis@x" },
    { id: "eva", full_name: "Eva", email: "eva@x" },
  ],
  sessions: [
    {
      id: "s1",
      mode: "pace",
      shuffle: false,
      status: "active",
      is_open: true,
      closes_at: "2026-10-10T05:00:00Z",
      created_at: "2026-10-09T15:00:00Z",
      started_at: "2026-10-09T15:00:00Z",
      ended_at: null,
      notes: null,
      participants: [
        {
          student_id: "ana",
          score: 200,
          answered: 2,
          correct: 2,
          joined_at: "2026-10-09T15:30:00Z",
          last_seen_at: null,
          first_answer_at: "2026-10-09T15:31:00Z",
          last_answer_at: "2026-10-09T15:36:00Z",
        },
        {
          student_id: "luis",
          score: 100,
          answered: 1,
          correct: 1,
          joined_at: "2026-10-09T23:00:00Z",
          last_seen_at: null,
          first_answer_at: "2026-10-09T23:01:00Z",
          last_answer_at: "2026-10-09T23:01:00Z",
        },
      ],
      per_question: [
        { exercise_id: "q1", total: 2, correct: 2 },
        { exercise_id: "q2", total: 1, correct: 1 },
      ],
      events: [
        { student_id: "ana", kind: "rejoin", detail: { gap_seconds: 600 }, at: "2026-10-09T15:40:00Z" },
        { student_id: "ana", kind: "rejoin", detail: { gap_seconds: 300 }, at: "2026-10-09T15:50:00Z" },
      ],
    },
  ],
};

describe("registro de entradas en el informe", () => {
  const s = buildReport(report).summaries[0];

  it("cuenta las entradas (la primera + cada regreso) y el tiempo entre su primera y última respuesta", () => {
    expect(s.perStudent.ana.entries).toBe(3);
    expect(s.perStudent.ana.activeMinutes).toBe(5);
    expect(s.perStudent.ana.joinedAt).toBe("2026-10-09T15:30:00Z");
    expect(s.perStudent.ana.status).toBe("complete");
  });

  it("quien respondió una sola pregunta tarda al menos 1 minuto y queda incompleto", () => {
    expect(s.perStudent.luis.activeMinutes).toBe(1);
    expect(s.perStudent.luis.status).toBe("partial");
    expect(s.perStudent.luis.entries).toBe(1);
  });

  it("quien nunca entró no tiene entradas ni fechas", () => {
    expect(s.perStudent.eva).toMatchObject({ entries: 0, joinedAt: null, activeMinutes: null, status: "absent" });
  });

  it("el CSV trae las columnas de entrada, término, minutos y entradas", () => {
    const csv = reportToCsv(report, buildReport(report));
    const header = csv.split("\r\n")[0];
    expect(header).toContain("Quiz 1 entró");
    expect(header).toContain("Quiz 1 terminó");
    expect(header).toContain("Quiz 1 minutos");
    expect(header).toContain("Quiz 1 entradas");
    const ana = csv.split("\r\n").find((l) => l.startsWith('"Ana"'))!;
    expect(ana).toContain('"3"'); // entradas
  });
});

describe("quizSession", () => {
  it("isExpired solo es verdad con hora de cierre ya pasada", () => {
    const now = Date.parse("2026-10-10T00:00:00Z");
    expect(isExpired({}, now)).toBe(false);
    expect(isExpired({ closes_at: null }, now)).toBe(false);
    expect(isExpired({ closes_at: "2026-10-10T05:00:00Z" }, now)).toBe(false);
    expect(isExpired({ closes_at: "2026-10-09T23:59:59Z" }, now)).toBe(true);
  });

  it("localDateTimeInput da el formato de datetime-local", () => {
    expect(localDateTimeInput(24)).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:00$/);
  });
});
