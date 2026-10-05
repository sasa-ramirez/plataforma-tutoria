/** Informe de falencias de una materia a partir de TODOS sus parciales
 * finalizados: qué temas domina el estudiante, cuáles están flojos y qué
 * preguntas falló. Todo se calcula aquí, sin IA. */

export interface ReportExam {
  id: string;
  title: string;
  created_at: string;
  question_count: number;
  correct_count: number | null;
}

export interface ReportQuestion {
  exam_id: string;
  topic: string;
  question: string;
  options: string[];
  correct: number;
  selected: number | null;
  explanation: string | null;
}

export type TopicLevel = "dominado" | "progreso" | "debil";
export type Trend = "up" | "down" | "flat";

export interface TopicStat {
  topic: string;
  seen: number;
  correct: number;
  pct: number;
  level: TopicLevel;
  /** Menos de 3 preguntas: el dato todavía es poco confiable. */
  lowData: boolean;
  /** Mejor o peor que antes (compara el último parcial del tema con los anteriores). */
  trend: Trend | null;
  /** Preguntas falladas (o sin responder), las más recientes primero. */
  missed: (ReportQuestion & { examTitle: string })[];
}

export interface ExamPoint {
  id: string;
  title: string;
  date: string;
  pct: number;
  correct: number;
  total: number;
}

export interface StudyReportData {
  examCount: number;
  totalQuestions: number;
  totalCorrect: number;
  avgPct: number;
  lastPct: number | null;
  /** Último menos primero, en puntos porcentuales (solo con 2+ parciales). */
  delta: number | null;
  unanswered: number;
  exams: ExamPoint[];
  topics: TopicStat[]; // de más débil a más fuerte
  weak: TopicStat[];
  strong: TopicStat[];
  recommendations: string[];
}

const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);
export const levelOf = (p: number): TopicLevel => (p >= 80 ? "dominado" : p >= 60 ? "progreso" : "debil");

export function buildStudyReport(exams: ReportExam[], questions: ReportQuestion[]): StudyReportData {
  const ordered = [...exams].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const examIdx = new Map(ordered.map((e, i) => [e.id, i]));
  const titleOf = new Map(ordered.map((e) => [e.id, e.title]));
  const valid = questions.filter((q) => examIdx.has(q.exam_id));

  const points: ExamPoint[] = ordered.map((e) => {
    const qs = valid.filter((q) => q.exam_id === e.id);
    const total = e.question_count || qs.length;
    const correct = Math.min(total, e.correct_count ?? qs.filter((q) => q.selected === q.correct).length);
    return { id: e.id, title: e.title, date: e.created_at, pct: pct(correct, total), correct, total };
  });

  // Por tema, con su historial parcial por parcial para la tendencia.
  const byTopic = new Map<string, ReportQuestion[]>();
  for (const q of valid) byTopic.set(q.topic, [...(byTopic.get(q.topic) ?? []), q]);

  const topics: TopicStat[] = [...byTopic.entries()].map(([topic, qs]) => {
    const correct = qs.filter((q) => q.selected === q.correct).length;
    const p = pct(correct, qs.length);

    const examsWithTopic = [...new Set(qs.map((q) => examIdx.get(q.exam_id)!))].sort((a, b) => a - b);
    let trend: Trend | null = null;
    if (examsWithTopic.length >= 2) {
      const lastI = examsWithTopic[examsWithTopic.length - 1];
      const last = qs.filter((q) => examIdx.get(q.exam_id) === lastI);
      const before = qs.filter((q) => examIdx.get(q.exam_id)! < lastI);
      const diff =
        pct(last.filter((q) => q.selected === q.correct).length, last.length) -
        pct(before.filter((q) => q.selected === q.correct).length, before.length);
      trend = diff >= 15 ? "up" : diff <= -15 ? "down" : "flat";
    }

    const missed = qs
      .filter((q) => q.selected !== q.correct)
      .sort((a, b) => examIdx.get(b.exam_id)! - examIdx.get(a.exam_id)!)
      .slice(0, 5)
      .map((q) => ({ ...q, examTitle: titleOf.get(q.exam_id) ?? "" }));

    return { topic, seen: qs.length, correct, pct: p, level: levelOf(p), lowData: qs.length < 3, trend, missed };
  });
  topics.sort((a, b) => a.pct - b.pct || b.seen - a.seen);

  const weak = topics.filter((t) => t.level === "debil");
  const strong = topics.filter((t) => t.level === "dominado" && !t.lowData);

  const totalQuestions = points.reduce((a, p) => a + p.total, 0);
  const totalCorrect = points.reduce((a, p) => a + p.correct, 0);
  const unanswered = valid.filter((q) => q.selected === null).length;
  const delta = points.length >= 2 ? points[points.length - 1].pct - points[0].pct : null;

  const recommendations: string[] = [];
  if (points.length > 0) {
    if (weak.length > 0) {
      recommendations.push(
        `Prioriza estos temas: ${weak
          .slice(0, 3)
          .map((t) => `${t.topic} (${t.pct}%)`)
          .join(", ")}. Repasa sus notas y haz un parcial de refuerzo.`,
      );
    } else {
      recommendations.push("No tienes temas flojos por ahora. Sigue practicando con parciales variados o más difíciles.");
    }
    if (strong.length > 0) {
      recommendations.push(`Ya dominas: ${strong.slice(0, 4).map((t) => t.topic).join(", ")}. Basta con repasarlos de vez en cuando.`);
    }
    if (delta !== null && Math.abs(delta) >= 5) {
      recommendations.push(
        delta > 0
          ? `Vas mejorando: subiste ${delta} puntos desde tu primer parcial.`
          : `Tu último parcial salió ${Math.abs(delta)} puntos por debajo del primero: revisa qué temas nuevos entraron.`,
      );
    }
    const thin = topics.filter((t) => t.lowData && t.level !== "dominado");
    if (thin.length > 0) {
      recommendations.push(
        `De ${thin
          .slice(0, 3)
          .map((t) => t.topic)
          .join(", ")} hay muy pocas preguntas: haz otro parcial para confirmar cómo vas.`,
      );
    }
    if (unanswered >= 3) {
      recommendations.push(`Dejaste ${unanswered} preguntas sin responder. En un parcial real, responder algo siempre suma más que dejar en blanco.`);
    }
  }

  return {
    examCount: points.length,
    totalQuestions,
    totalCorrect,
    avgPct: pct(totalCorrect, totalQuestions),
    lastPct: points.length ? points[points.length - 1].pct : null,
    delta,
    unanswered,
    exams: points,
    topics,
    weak,
    strong,
    recommendations,
  };
}
