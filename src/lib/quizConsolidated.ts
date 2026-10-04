/** Consolidado "lo mejor de cada estudiante" a partir de TODOS los quizzes en
 * vivo de un curso. Para cada pregunta se toma el mejor de sus intentos
 * (si la acertó en alguna sesión, cuenta como acertada), así quien repitió
 * un quiz o lo hizo en pedazos no queda penalizado por el peor intento. */

export interface ConsolidatedData {
  sessions: { id: string; assignment_id: string }[];
  assignments: { id: string; title: string }[];
  participants: { id: string; session_id: string; student_id: string }[];
  answers: { participant_id: string; exercise_id: string; correct: boolean }[];
  exercises: {
    id: string;
    assignment_id: string;
    title: string;
    topic: string | null;
    deleted_at: string | null;
  }[];
  roster: { id: string; full_name: string | null; email: string | null }[];
  /** Solo lo manda el informe de coordinación. */
  course_title?: string | null;
}

export type Level = "Alto" | "Medio" | "Bajo";

export interface TopicResult {
  topic: string;
  answered: number;
  correct: number;
  pct: number;
}

export interface MissedQuestion {
  title: string;
  topic: string;
  quiz: string;
}

export interface QuizInfo {
  assignmentId: string;
  title: string;
  questionCount: number;
  sessionCount: number;
  /** Estudiantes que entraron a este quiz (en cualquiera de sus sesiones). */
  attended: number;
  /** De ellos, los que respondieron todas las preguntas. */
  completed: number;
  /** % de aciertos del mejor intento de cada uno, sobre lo respondido. */
  accuracy: number | null;
}

export interface StudentConsolidated {
  id: string;
  name: string;
  email: string | null;
  quizzesAttended: number;
  perQuiz: Record<string, { answered: number; correct: number; total: number; pct: number | null } | null>;
  answered: number;
  correct: number;
  accuracy: number;
  /** Preguntas respondidas / preguntas de los quizzes a los que sí entró. */
  coverage: number;
  level: Level;
  strengths: TopicResult[];
  weaknesses: TopicResult[];
  missed: MissedQuestion[];
  unanswered: number;
  analysis: string;
}

export interface GroupTopic extends TopicResult {
  students: number;
}

export interface Consolidated {
  quizzes: QuizInfo[];
  students: StudentConsolidated[];
  /** Inscritos que no aparecen en ningún quiz. */
  absent: { id: string; name: string }[];
  groupAccuracy: number | null;
  groupTopics: GroupTopic[];
  hardestQuestions: { title: string; topic: string; quiz: string; pct: number; students: number }[];
}

const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);
const levelOf = (acc: number): Level => (acc >= 80 ? "Alto" : acc >= 60 ? "Medio" : "Bajo");
const nameOf = (r: { full_name: string | null; email: string | null }) =>
  r.full_name || r.email || "Estudiante";

export function buildConsolidated(d: ConsolidatedData): Consolidated {
  const rosterIds = new Set(d.roster.map((r) => r.id));
  const sessionAssignment = new Map(d.sessions.map((s) => [s.id, s.assignment_id]));
  const titleOf = new Map(d.assignments.map((a) => [a.id, a.title]));

  // Participaciones solo de inscritos (descarta las pruebas del profesor).
  const parts = d.participants.filter((p) => rosterIds.has(p.student_id));
  const partById = new Map(parts.map((p) => [p.id, p]));
  const answers = d.answers.filter((a) => partById.has(a.participant_id));

  // Quizzes con al menos una respuesta de un inscrito.
  const answeredExercises = new Set(answers.map((a) => a.exercise_id));
  const exById = new Map(d.exercises.map((e) => [e.id, e]));
  const quizIds: string[] = [];
  for (const a of answers) {
    const ex = exById.get(a.exercise_id);
    if (ex && !quizIds.includes(ex.assignment_id)) quizIds.push(ex.assignment_id);
  }

  // Preguntas vigentes de cada quiz (las borradas solo cuentan si alguien las respondió).
  const questionsOf = (qid: string) =>
    d.exercises.filter(
      (e) => e.assignment_id === qid && (!e.deleted_at || answeredExercises.has(e.id)),
    );
  const topicOf = (e: { topic: string | null; assignment_id: string }) =>
    e.topic?.trim() || titleOf.get(e.assignment_id) || "General";

  const quizzes: QuizInfo[] = quizIds.map((qid) => ({
    assignmentId: qid,
    title: titleOf.get(qid) ?? "Quiz",
    questionCount: questionsOf(qid).length,
    sessionCount: d.sessions.filter((s) => s.assignment_id === qid).length,
    attended: 0,
    completed: 0,
    accuracy: null,
  }));

  const students: StudentConsolidated[] = [];
  const absent: { id: string; name: string }[] = [];

  // Para el análisis del grupo: por pregunta, cuántos respondieron / acertaron (mejor intento).
  const qAgg = new Map<string, { answered: number; correct: number }>();

  for (const r of d.roster) {
    const myParts = parts.filter((p) => p.student_id === r.id);
    if (myParts.length === 0) {
      absent.push({ id: r.id, name: nameOf(r) });
      continue;
    }
    const myPartIds = new Set(myParts.map((p) => p.id));
    const attendedQuizzes = new Set(myParts.map((p) => sessionAssignment.get(p.session_id)!));

    // Mejor resultado por pregunta entre todos sus intentos.
    const best = new Map<string, boolean>();
    for (const a of answers) {
      if (!myPartIds.has(a.participant_id)) continue;
      best.set(a.exercise_id, (best.get(a.exercise_id) ?? false) || a.correct);
    }

    const perQuiz: StudentConsolidated["perQuiz"] = {};
    const topics = new Map<string, { answered: number; correct: number }>();
    const missed: MissedQuestion[] = [];
    let answered = 0;
    let correct = 0;
    let unanswered = 0;
    let totalOfAttended = 0;

    for (const q of quizzes) {
      if (!attendedQuizzes.has(q.assignmentId)) {
        perQuiz[q.assignmentId] = null;
        continue;
      }
      const qs = questionsOf(q.assignmentId);
      totalOfAttended += qs.length;
      let qa = 0;
      let qc = 0;
      for (const e of qs) {
        const res = best.get(e.id);
        if (res === undefined) {
          unanswered++;
          continue;
        }
        qa++;
        const t = topicOf(e);
        const agg = topics.get(t) ?? { answered: 0, correct: 0 };
        agg.answered++;
        const g = qAgg.get(e.id) ?? { answered: 0, correct: 0 };
        g.answered++;
        if (res) {
          qc++;
          agg.correct++;
          g.correct++;
        } else {
          missed.push({ title: e.title, topic: t, quiz: q.title });
        }
        topics.set(t, agg);
        qAgg.set(e.id, g);
      }
      answered += qa;
      correct += qc;
      perQuiz[q.assignmentId] = {
        answered: qa,
        correct: qc,
        total: qs.length,
        pct: qa > 0 ? pct(qc, qa) : null,
      };
    }

    const topicList: TopicResult[] = [...topics.entries()].map(([topic, v]) => ({
      topic,
      answered: v.answered,
      correct: v.correct,
      pct: pct(v.correct, v.answered),
    }));
    const strengths = topicList.filter((t) => t.pct >= 80).sort((a, b) => b.pct - a.pct);
    const weaknesses = topicList.filter((t) => t.pct < 60).sort((a, b) => a.pct - b.pct);
    const accuracy = pct(correct, answered);
    const coverage = pct(answered, totalOfAttended);

    const parts_: string[] = [];
    if (answered === 0) {
      parts_.push("Entró a los quizzes pero no alcanzó a responder ninguna pregunta.");
    } else {
      parts_.push(
        `Acertó ${correct} de las ${answered} preguntas que respondió (${accuracy}%) en ${attendedQuizzes.size} de ${quizzes.length} quiz${quizzes.length === 1 ? "" : "zes"}.`,
      );
      if (strengths.length)
        parts_.push(`Domina: ${strengths.slice(0, 3).map((t) => t.topic).join(", ")}.`);
      if (weaknesses.length)
        parts_.push(
          `Necesita reforzar: ${weaknesses.slice(0, 3).map((t) => `${t.topic} (${t.pct}%)`).join(", ")}.`,
        );
      else if (!strengths.length) parts_.push("Rendimiento medio, sin un tema claramente débil.");
      if (unanswered > 0 && coverage < 80)
        parts_.push(`Dejó ${unanswered} pregunta${unanswered === 1 ? "" : "s"} sin responder, así que la nota puede subestimarlo.`);
    }

    students.push({
      id: r.id,
      name: nameOf(r),
      email: r.email,
      quizzesAttended: attendedQuizzes.size,
      perQuiz,
      answered,
      correct,
      accuracy,
      coverage,
      level: levelOf(accuracy),
      strengths,
      weaknesses,
      missed,
      unanswered,
      analysis: parts_.join(" "),
    });
  }

  students.sort((a, b) => b.accuracy - a.accuracy || b.answered - a.answered);

  for (const q of quizzes) {
    let ans = 0;
    let cor = 0;
    for (const s of students) {
      const r = s.perQuiz[q.assignmentId];
      if (!r) continue;
      q.attended++;
      if (r.total > 0 && r.answered >= r.total) q.completed++;
      ans += r.answered;
      cor += r.correct;
    }
    q.accuracy = ans > 0 ? pct(cor, ans) : null;
  }

  // Temas del grupo (mejor intento de cada estudiante).
  const groupTopicMap = new Map<string, { answered: number; correct: number; students: Set<string> }>();
  for (const r of d.roster) {
    const s = students.find((x) => x.id === r.id);
    if (!s) continue;
    const myPartIds = new Set(parts.filter((p) => p.student_id === r.id).map((p) => p.id));
    const best = new Map<string, boolean>();
    for (const a of answers) {
      if (!myPartIds.has(a.participant_id)) continue;
      best.set(a.exercise_id, (best.get(a.exercise_id) ?? false) || a.correct);
    }
    for (const [exId, ok] of best) {
      const e = exById.get(exId);
      if (!e) continue;
      const t = topicOf(e);
      const g = groupTopicMap.get(t) ?? { answered: 0, correct: 0, students: new Set<string>() };
      g.answered++;
      if (ok) g.correct++;
      g.students.add(r.id);
      groupTopicMap.set(t, g);
    }
  }
  const groupTopics: GroupTopic[] = [...groupTopicMap.entries()]
    .map(([topic, g]) => ({
      topic,
      answered: g.answered,
      correct: g.correct,
      pct: pct(g.correct, g.answered),
      students: g.students.size,
    }))
    .sort((a, b) => a.pct - b.pct);

  const hardestQuestions = [...qAgg.entries()]
    .map(([id, v]) => {
      const e = exById.get(id)!;
      return {
        title: e.title,
        topic: topicOf(e),
        quiz: titleOf.get(e.assignment_id) ?? "Quiz",
        pct: pct(v.correct, v.answered),
        students: v.answered,
      };
    })
    .filter((q) => q.students >= 2)
    .sort((a, b) => a.pct - b.pct)
    .slice(0, 8);

  const totalAnswered = students.reduce((a, s) => a + s.answered, 0);
  const totalCorrect = students.reduce((a, s) => a + s.correct, 0);

  return {
    quizzes,
    students,
    absent,
    groupAccuracy: totalAnswered > 0 ? pct(totalCorrect, totalAnswered) : null,
    groupTopics,
    hardestQuestions,
  };
}

/** CSV (con BOM para Excel): una fila por estudiante. */
export function consolidatedToCsv(c: Consolidated): string {
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const header = [
    "Estudiante",
    "Correo",
    "Quizzes presentados",
    ...c.quizzes.map((q) => `Mejor % · ${q.title}`),
    "Acierto global (mejor intento)",
    "Nivel",
    "Falencias",
    "Fortalezas",
  ];
  const rows = c.students.map((s) => [
    s.name,
    s.email ?? "",
    `${s.quizzesAttended}/${c.quizzes.length}`,
    ...c.quizzes.map((q) => {
      const r = s.perQuiz[q.assignmentId];
      return r && r.pct !== null ? `${r.pct}%` : "No presentó";
    }),
    `${s.accuracy}%`,
    s.level,
    s.weaknesses.map((t) => `${t.topic} (${t.pct}%)`).join("; "),
    s.strengths.map((t) => t.topic).join("; "),
  ]);
  return "﻿" + [header, ...rows].map((r) => r.map(esc).join(",")).join("\r\n");
}
