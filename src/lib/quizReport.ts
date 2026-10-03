import type { QuizReport, QuizReportSession } from "@/services/quiz";

export type ParticipationStatus =
  | "complete" // respondió todas las preguntas
  | "partial" // entró y respondió algunas, pero no todas
  | "joined" // entró y no alcanzó a responder nada
  | "absent"; // inscrito que nunca entró

export interface StudentSessionResult {
  status: ParticipationStatus;
  answered: number;
  correct: number;
  score: number;
  lastSeenAt: string | null;
  reconnects: number;
  offlineSeconds: number;
  errors: string[];
}

export interface SessionSummary {
  session: QuizReportSession;
  /** Número de orden entre los quizzes con respuestas (1, 2, 3…). */
  number: number;
  enrolled: number;
  joined: number;
  complete: number;
  partial: number;
  joinedOnly: number;
  absent: number;
  accuracy: number | null; // % de aciertos sobre lo respondido
  avgScore: number | null; // promedio de puntaje de quienes entraron
  durationMin: number | null;
  perStudent: Record<string, StudentSessionResult>;
  /** Hubo quien se reconectó, perdió señal o vio un error. */
  hasConnectionIncidents: boolean;
}

export interface BuiltReport {
  questionCount: number;
  /** Sesiones con al menos una respuesta (los quizzes "de verdad"). */
  summaries: SessionSummary[];
  /** Sesiones creadas pero sin una sola respuesta (QR repetidos, pruebas). */
  emptySessions: QuizReportSession[];
  paragraphs: string[];
}

const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);

export function studentName(
  roster: QuizReport["roster"],
  id: string,
): string {
  const s = roster.find((r) => r.id === id);
  return s?.full_name || s?.email || "Estudiante";
}

export function sessionLabel(s: SessionSummary): string {
  const d = new Date(s.session.created_at).toLocaleString("es-CO", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  return `Quiz ${s.number} · ${d}`;
}

function summarize(
  report: QuizReport,
  session: QuizReportSession,
  number: number,
  total: number,
): SessionSummary {
  const perStudent: Record<string, StudentSessionResult> = {};
  const byStudent = new Map(session.participants.map((p) => [p.student_id, p]));

  for (const r of report.roster) {
    const p = byStudent.get(r.id);
    const events = session.events.filter((e) => e.student_id === r.id);
    const reconnects = events.filter((e) => e.kind === "rejoin").length;
    const offlineSeconds = events
      .filter((e) => e.kind === "offline")
      .reduce((acc, e) => acc + (Number((e.detail as { seconds?: number } | null)?.seconds) || 0), 0);
    const errors = events
      .filter((e) => e.kind === "error")
      .map((e) => String((e.detail as { message?: string } | null)?.message || "error"));

    let status: ParticipationStatus = "absent";
    if (p) {
      status = p.answered >= total && total > 0 ? "complete" : p.answered > 0 ? "partial" : "joined";
    }
    perStudent[r.id] = {
      status,
      answered: p?.answered ?? 0,
      correct: p?.correct ?? 0,
      score: p?.score ?? 0,
      lastSeenAt: p?.last_seen_at ?? p?.last_answer_at ?? p?.joined_at ?? null,
      reconnects,
      offlineSeconds,
      errors,
    };
  }

  const results = Object.values(perStudent);
  const answeredTotal = results.reduce((a, r) => a + r.answered, 0);
  const correctTotal = results.reduce((a, r) => a + r.correct, 0);
  const joinedList = results.filter((r) => r.status !== "absent");
  const start = session.started_at ?? session.created_at;
  const durationMin = session.ended_at
    ? Math.max(1, Math.round((new Date(session.ended_at).getTime() - new Date(start).getTime()) / 60000))
    : null;

  return {
    session,
    number,
    enrolled: report.roster.length,
    joined: joinedList.length,
    complete: results.filter((r) => r.status === "complete").length,
    partial: results.filter((r) => r.status === "partial").length,
    joinedOnly: results.filter((r) => r.status === "joined").length,
    absent: results.filter((r) => r.status === "absent").length,
    accuracy: answeredTotal > 0 ? pct(correctTotal, answeredTotal) : null,
    avgScore: joinedList.length
      ? Math.round(joinedList.reduce((a, r) => a + r.score, 0) / joinedList.length)
      : null,
    durationMin,
    perStudent,
    hasConnectionIncidents: results.some(
      (r) => r.reconnects > 0 || r.offlineSeconds > 0 || r.errors.length > 0,
    ),
  };
}

/** Convierte lo que devuelve el servidor en el informe listo para mostrar. */
export function buildReport(report: QuizReport): BuiltReport {
  const total = report.questions.length;
  const withAnswers = report.sessions.filter((s) => s.per_question.length > 0);
  const emptySessions = report.sessions.filter((s) => s.per_question.length === 0);
  const summaries = withAnswers.map((s, i) => summarize(report, s, i + 1, total));

  const paragraphs: string[] = [];
  if (summaries.length === 0) {
    paragraphs.push("Todavía no hay quizzes con respuestas para esta tarea.");
    return { questionCount: total, summaries, emptySessions, paragraphs };
  }

  const enrolled = report.roster.length;
  paragraphs.push(
    `Se aplicaron ${summaries.length} quiz${summaries.length === 1 ? "" : "zes"} en vivo de ${total} pregunta${
      total === 1 ? "" : "s"
    } de opción múltiple a un grupo de ${enrolled} estudiante${enrolled === 1 ? "" : "s"} inscrito${
      enrolled === 1 ? "" : "s"
    }, desde el celular de cada uno.`,
  );

  if (emptySessions.length > 0) {
    paragraphs.push(
      emptySessions.length === 1
        ? "Además se creó 1 sesión que no recibió ninguna respuesta (un código QR repetido para quienes llegaron tarde). Se excluye de las cifras."
        : `Además se crearon ${emptySessions.length} sesiones que no recibieron ninguna respuesta (códigos QR repetidos para quienes llegaron tarde). Se excluyen de las cifras.`,
    );
  }

  const first = summaries[0];
  const last = summaries[summaries.length - 1];
  if (summaries.length > 1) {
    paragraphs.push(
      `La participación fue de ${first.complete} de ${enrolled} que terminaron en el primero a ${last.complete} de ${enrolled} en el último.`,
    );
  }

  const notFinished = Object.entries(last.perStudent).filter(([, r]) => r.status !== "complete");
  if (notFinished.length > 0) {
    const names = notFinished
      .map(([id, r]) => {
        const nm = studentName(report.roster, id);
        if (r.status === "absent") return `${nm} (no logró entrar)`;
        return `${nm} (respondió ${r.answered} de ${total})`;
      })
      .join("; ");
    paragraphs.push(
      `En el último quiz ${notFinished.length} estudiante${
        notFinished.length === 1 ? "" : "s"
      } no logr${notFinished.length === 1 ? "ó" : "aron"} completarlo: ${names}. Las causas están en "Incidencias" más abajo.`,
    );
  } else {
    paragraphs.push("En el último quiz todos los inscritos lo completaron.");
  }

  if (last.accuracy !== null) {
    paragraphs.push(
      `En el último quiz el acierto promedio fue de ${last.accuracy}% sobre lo respondido${
        last.durationMin ? ` y duró ${last.durationMin} min` : ""
      }.`,
    );
  }

  return { questionCount: total, summaries, emptySessions, paragraphs };
}

/** CSV (con BOM, para que Excel respete las tildes) de la matriz estudiante × quiz. */
export function reportToCsv(report: QuizReport, built: BuiltReport): string {
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const header = ["Estudiante", "Correo"];
  for (const s of built.summaries) {
    const base = `Quiz ${s.number}`;
    header.push(`${base} estado`, `${base} respondidas`, `${base} puntaje`, `${base} reconexiones`);
  }
  const STATUS: Record<ParticipationStatus, string> = {
    complete: "Completo",
    partial: "Incompleto",
    joined: "Entró sin responder",
    absent: "No participó",
  };
  const rows = report.roster.map((r) => {
    const row: (string | number)[] = [r.full_name ?? "", r.email ?? ""];
    for (const s of built.summaries) {
      const x = s.perStudent[r.id];
      row.push(STATUS[x.status], x.answered, x.score, x.reconnects);
    }
    return row;
  });
  return "﻿" + [header, ...rows].map((r) => r.map(esc).join(",")).join("\r\n");
}
