import { describe, it, expect } from "vitest";
import { buildStudyReport, type ReportExam, type ReportQuestion } from "./studyReport";

const exam = (id: string, day: number, count: number, correct: number): ReportExam => ({
  id,
  title: `Parcial ${id}`,
  created_at: `2026-10-0${day}T10:00:00Z`,
  question_count: count,
  correct_count: correct,
});

const q = (exam_id: string, topic: string, ok: boolean | null, n = 1): ReportQuestion => ({
  exam_id,
  topic,
  question: `Pregunta ${topic} ${exam_id} ${n}`,
  options: ["a", "b", "c", "d"],
  correct: 1,
  selected: ok === null ? null : ok ? 1 : 0,
  explanation: "porque sí",
});

describe("buildStudyReport", () => {
  it("sin parciales no inventa nada", () => {
    const r = buildStudyReport([], []);
    expect(r.examCount).toBe(0);
    expect(r.topics).toEqual([]);
    expect(r.recommendations).toEqual([]);
    expect(r.lastPct).toBeNull();
  });

  it("clasifica los temas, de más débil a más fuerte", () => {
    const exams = [exam("A", 1, 8, 5)];
    const qs = [
      ...[true, true, true, true].map((ok, i) => q("A", "Derivadas", ok, i)), // 100%
      ...[true, false, false, false].map((ok, i) => q("A", "Integrales", ok, i)), // 25%
    ];
    const r = buildStudyReport(exams, qs);
    expect(r.topics.map((t) => t.topic)).toEqual(["Integrales", "Derivadas"]);
    expect(r.weak.map((t) => t.topic)).toEqual(["Integrales"]);
    expect(r.strong.map((t) => t.topic)).toEqual(["Derivadas"]);
    expect(r.topics[0].level).toBe("debil");
    expect(r.recommendations[0]).toContain("Integrales (25%)");
  });

  it("agrupa las falladas, incluidas las sin responder, con las más recientes primero", () => {
    const exams = [exam("A", 1, 2, 0), exam("B", 2, 2, 0)];
    const qs = [q("A", "T", false, 1), q("A", "T", null, 2), q("B", "T", false, 1)];
    const t = buildStudyReport(exams, qs).topics[0];
    expect(t.missed).toHaveLength(3);
    expect(t.missed[0].exam_id).toBe("B");
    expect(t.missed[0].examTitle).toBe("Parcial B");
  });

  it("detecta la tendencia de un tema entre parciales", () => {
    const exams = [exam("A", 1, 4, 1), exam("B", 2, 4, 4)];
    const qs = [
      ...[false, false, false, true].map((ok, i) => q("A", "Tema", ok, i)), // 25% antes
      ...[true, true, true, true].map((ok, i) => q("B", "Tema", ok, i)), // 100% ahora
    ];
    const t = buildStudyReport(exams, qs).topics[0];
    expect(t.trend).toBe("up");
  });

  it("mide el avance global y avisa de los datos escasos", () => {
    const exams = [exam("A", 1, 10, 4), exam("B", 3, 10, 8)];
    const qs = [q("A", "Raro", false), q("B", "Raro", false)];
    const r = buildStudyReport(exams, qs);
    expect(r.delta).toBe(40);
    expect(r.avgPct).toBe(60);
    expect(r.lastPct).toBe(80);
    expect(r.topics[0].lowData).toBe(true);
    expect(r.recommendations.join(" ")).toContain("subiste 40 puntos");
    expect(r.recommendations.join(" ")).toContain("muy pocas preguntas");
  });

  it("ignora preguntas de parciales que no están en la lista", () => {
    const r = buildStudyReport([exam("A", 1, 1, 1)], [q("A", "X", true), q("Z", "X", false)]);
    expect(r.topics[0].seen).toBe(1);
  });
});
