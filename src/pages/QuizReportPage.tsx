import { useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Download, FileText, Lock, Printer } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useQuizReport, useSetQuizNotes } from "@/hooks/useQuiz";
import { useAssignment } from "@/hooks/useAssignments";
import { useToast } from "@/components/ui/toast";
import { EmptyState } from "@/components/common/EmptyState";
import { FullScreenLoader } from "@/components/common/Spinner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  buildReport,
  reportToCsv,
  sessionLabel,
  studentName,
  type ParticipationStatus,
  type SessionSummary,
} from "@/lib/quizReport";
import type { QuizReport } from "@/services/quiz";
import { cn } from "@/lib/utils";

const STATUS_COLOR: Record<ParticipationStatus, string> = {
  complete: "text-success",
  partial: "text-warning",
  joined: "text-warning",
  absent: "text-destructive",
};

const fmtTime = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })
    : "—";

/** Informe imprimible de todos los quizzes en vivo de una tarea: participación,
 * resultados por pregunta e incidencias (quién no pudo terminar y por qué).
 * Pensado para guardarse como PDF y mandárselo a un profesor. */
export function QuizReportPage() {
  const { assignmentId = "" } = useParams();
  const { isTeacher } = useAuth();
  const { toast } = useToast();
  const { data: report, isLoading, isError, error } = useQuizReport(assignmentId);
  const { data: assignment } = useAssignment(assignmentId);
  const built = useMemo(() => (report ? buildReport(report) : null), [report]);

  if (!isTeacher) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <EmptyState
          icon={Lock}
          title="Solo el profesor puede ver esto"
          description="El informe es para el profesor dueño del curso."
          action={
            <Button asChild variant="brand">
              <Link to="/app">Volver al inicio</Link>
            </Button>
          }
        />
      </div>
    );
  }
  if (isLoading) return <FullScreenLoader />;
  if (isError || !report || !built) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <EmptyState
          icon={FileText}
          title="No se pudo cargar el informe"
          description={error instanceof Error ? error.message : "Intenta de nuevo."}
          action={
            <Button asChild variant="brand">
              <Link to={`/app/assignments/${assignmentId}`}>Volver a la tarea</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const downloadCsv = () => {
    const blob = new Blob([reportToCsv(report, built)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `informe-quiz-${report.assignment.title.replace(/[^\w]+/g, "-").toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast("CSV descargado", "success");
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4 print:max-w-none print:p-0">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link
          to={`/app/assignments/${assignmentId}`}
          className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Volver a la tarea
        </Link>
        <div className="flex gap-2">
          {assignment?.course_id && (
            <Button asChild size="sm" variant="outline">
              <Link to={`/app/courses/${assignment.course_id}/quiz-consolidado`}>
                <FileText className="size-4" /> Consolidado del curso
              </Link>
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={downloadCsv}>
            <Download className="size-4" /> CSV (Excel)
          </Button>
          <Button size="sm" variant="brand" onClick={() => window.print()}>
            <Printer className="size-4" /> Imprimir / Guardar PDF
          </Button>
        </div>
      </div>

      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Informe de quizzes en vivo · Kódea
        </p>
        <h1 className="text-2xl font-extrabold">{report.assignment.title}</h1>
        <p className="text-sm text-muted-foreground">
          {report.assignment.course_name ? `${report.assignment.course_name} · ` : ""}
          Generado el{" "}
          {new Date().toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" })}
        </p>
      </header>

      {/* Resumen */}
      <Card>
        <CardContent className="space-y-2 p-4">
          <h2 className="font-bold">Resumen</h2>
          {built.paragraphs.map((p, i) => (
            <p key={i} className="text-sm leading-relaxed">
              {p}
            </p>
          ))}
        </CardContent>
      </Card>

      {built.summaries.length > 0 && (
        <>
          {/* Un quiz por fila */}
          <Card>
            <CardContent className="space-y-3 p-4">
              <h2 className="font-bold">Cada quiz</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="text-muted-foreground">
                    <tr className="border-b">
                      <th className="py-1.5 pr-2 font-semibold">Quiz</th>
                      <th className="px-2 font-semibold">Modo</th>
                      <th className="px-2 font-semibold">Entraron</th>
                      <th className="px-2 font-semibold">Terminaron</th>
                      <th className="px-2 font-semibold">No terminaron</th>
                      <th className="px-2 font-semibold">Acierto</th>
                      <th className="px-2 font-semibold">Duración</th>
                    </tr>
                  </thead>
                  <tbody>
                    {built.summaries.map((s) => (
                      <tr key={s.session.id} className="border-b last:border-0">
                        <td className="py-1.5 pr-2 font-semibold">{sessionLabel(s)}</td>
                        <td className="px-2">
                          {s.session.mode === "sync" ? "Mismo tiempo" : "A su ritmo"}
                          {s.session.shuffle ? " · barajado" : ""}
                        </td>
                        <td className="px-2">
                          {s.joined}/{s.enrolled}
                        </td>
                        <td className="px-2">{s.complete}</td>
                        <td
                          className={cn(
                            "px-2",
                            s.enrolled - s.complete > 0 && "font-semibold text-destructive",
                          )}
                        >
                          {s.enrolled - s.complete}
                        </td>
                        <td className="px-2">{s.accuracy !== null ? `${s.accuracy}%` : "—"}</td>
                        <td className="px-2">{s.durationMin ? `${s.durationMin} min` : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Matriz estudiante × quiz */}
          <ParticipationMatrix report={report} summaries={built.summaries} total={built.questionCount} />

          {/* Incidencias por quiz + notas del profe */}
          <Incidents report={report} summaries={built.summaries} total={built.questionCount} />

          {/* Acierto por pregunta */}
          <QuestionAccuracy report={report} summaries={built.summaries} />
        </>
      )}
    </div>
  );
}

function ParticipationMatrix({
  report,
  summaries,
  total,
}: {
  report: QuizReport;
  summaries: SessionSummary[];
  total: number;
}) {
  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <h2 className="font-bold">Participación por estudiante</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-muted-foreground">
              <tr className="border-b">
                <th className="py-1.5 pr-2 font-semibold">Estudiante</th>
                {summaries.map((s) => (
                  <th key={s.session.id} className="px-2 font-semibold">
                    Quiz {s.number}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {report.roster.map((r) => (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="py-1.5 pr-2 font-medium">{studentName(report.roster, r.id)}</td>
                  {summaries.map((s) => {
                    const x = s.perStudent[r.id];
                    return (
                      <td key={s.session.id} className={cn("px-2 font-semibold", STATUS_COLOR[x.status])}>
                        {x.status === "complete" && `✓ ${x.score} pts`}
                        {x.status === "partial" && `◐ ${x.answered}/${total}`}
                        {x.status === "joined" && "◐ 0 resp."}
                        {x.status === "absent" && "✗ no entró"}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-muted-foreground">
          ✓ completó el quiz · ◐ entró pero no terminó (respondidas/total) · ✗ nunca logró entrar.
        </p>
      </CardContent>
    </Card>
  );
}

function Incidents({
  report,
  summaries,
  total,
}: {
  report: QuizReport;
  summaries: SessionSummary[];
  total: number;
}) {
  const { toast } = useToast();
  const { mutateAsync: saveNotes } = useSetQuizNotes(report.assignment.id);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div>
          <h2 className="font-bold">Incidencias</h2>
          <p className="text-xs text-muted-foreground print:hidden">
            Lo que el sistema detectó de cada quiz. Escribe abajo lo que sepas (qué le pasó a cada
            estudiante); queda guardado y sale en el informe impreso.
          </p>
        </div>

        {summaries.map((s) => {
          const affected = report.roster.filter((r) => s.perStudent[r.id].status !== "complete");
          const note = drafts[s.session.id] ?? s.session.notes ?? "";
          return (
            <div key={s.session.id} className="space-y-1.5 border-t pt-3 first:border-t-0 first:pt-0">
              <p className="text-sm font-semibold">{sessionLabel(s)}</p>

              {affected.length === 0 && !s.hasConnectionIncidents ? (
                <p className="text-xs text-success">Sin incidencias: todos los inscritos terminaron.</p>
              ) : (
                <ul className="space-y-1 text-xs">
                  {affected.map((r) => {
                    const x = s.perStudent[r.id];
                    const extra: string[] = [];
                    if (x.reconnects > 0) extra.push(`se reconectó ${x.reconnects} vez(es)`);
                    if (x.offlineSeconds > 0) extra.push(`estuvo ${x.offlineSeconds}s sin internet`);
                    if (x.errors.length > 0) extra.push(`errores: ${x.errors.join(" / ")}`);
                    return (
                      <li key={r.id}>
                        <span className="font-semibold">{studentName(report.roster, r.id)}</span>
                        {" — "}
                        <span className={STATUS_COLOR[x.status]}>
                          {x.status === "absent"
                            ? "no logró entrar"
                            : `respondió ${x.answered} de ${total}, última señal ${fmtTime(x.lastSeenAt)}`}
                        </span>
                        {extra.length > 0 && <span className="text-muted-foreground"> ({extra.join("; ")})</span>}
                      </li>
                    );
                  })}
                  {/* Quienes SÍ terminaron pero tuvieron cortes: también es evidencia. */}
                  {report.roster
                    .filter((r) => {
                      const x = s.perStudent[r.id];
                      return x.status === "complete" && (x.reconnects > 0 || x.errors.length > 0);
                    })
                    .map((r) => {
                      const x = s.perStudent[r.id];
                      return (
                        <li key={r.id} className="text-muted-foreground">
                          <span className="font-semibold text-foreground">
                            {studentName(report.roster, r.id)}
                          </span>{" "}
                          terminó, pero se reconectó {x.reconnects} vez(es)
                          {x.errors.length > 0 ? ` y tuvo ${x.errors.length} error(es)` : ""}.
                        </li>
                      );
                    })}
                </ul>
              )}

              <Textarea
                value={note}
                onChange={(e) => setDrafts((d) => ({ ...d, [s.session.id]: e.target.value }))}
                onBlur={async () => {
                  if (drafts[s.session.id] === undefined) return;
                  try {
                    await saveNotes({ sessionId: s.session.id, notes: drafts[s.session.id] });
                    toast("Nota guardada", "success");
                  } catch (e) {
                    toast(e instanceof Error ? e.message : "No se pudo guardar", "error");
                  }
                }}
                placeholder="Qué pasó (ej.: «Ana: la app la sacó con un error», «Luis: se quedó sin datos móviles»)"
                rows={2}
                className="text-xs print:hidden"
              />
              {note.trim() && (
                <p className="hidden whitespace-pre-wrap rounded-lg bg-muted/50 p-2 text-xs print:block">
                  <span className="font-semibold">Observaciones del profesor: </span>
                  {note}
                </p>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function QuestionAccuracy({
  report,
  summaries,
}: {
  report: QuizReport;
  summaries: SessionSummary[];
}) {
  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <h2 className="font-bold">Acierto por pregunta</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-muted-foreground">
              <tr className="border-b">
                <th className="py-1.5 pr-2 font-semibold">Pregunta</th>
                {summaries.map((s) => (
                  <th key={s.session.id} className="px-2 font-semibold">
                    Quiz {s.number}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {report.questions.map((q, i) => (
                <tr key={q.id} className="border-b last:border-0">
                  <td className="max-w-[18rem] py-1.5 pr-2">
                    <span className="line-clamp-2 print:line-clamp-none">
                      {i + 1}. {q.title}
                    </span>
                  </td>
                  {summaries.map((s) => {
                    const pq = s.session.per_question.find((x) => x.exercise_id === q.id);
                    const v = pq && pq.total > 0 ? Math.round((pq.correct / pq.total) * 100) : null;
                    return (
                      <td
                        key={s.session.id}
                        className={cn(
                          "px-2 font-semibold",
                          v === null
                            ? "text-muted-foreground"
                            : v >= 70
                              ? "text-success"
                              : v >= 40
                                ? "text-warning"
                                : "text-destructive",
                        )}
                      >
                        {v === null ? "—" : `${v}%`}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
