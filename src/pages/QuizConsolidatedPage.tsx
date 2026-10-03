import { useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Download, FileText, Lock, Printer } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useCourseQuizData } from "@/hooks/useQuiz";
import { useCourse } from "@/hooks/useCourses";
import { useToast } from "@/components/ui/toast";
import { EmptyState } from "@/components/common/EmptyState";
import { FullScreenLoader } from "@/components/common/Spinner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { buildConsolidated, consolidatedToCsv, type Level } from "@/lib/quizConsolidated";
import { cn } from "@/lib/utils";

const LEVEL_COLOR: Record<Level, string> = {
  Alto: "text-success",
  Medio: "text-warning",
  Bajo: "text-destructive",
};
const pctColor = (v: number) => (v >= 80 ? "text-success" : v >= 60 ? "text-warning" : "text-destructive");

/** Consolidado del curso: lo mejor de cada estudiante entre todos sus quizzes,
 * con sus fortalezas y falencias por tema. Imprimible / exportable. */
export function QuizConsolidatedPage() {
  const { courseId = "" } = useParams();
  const { isTeacher } = useAuth();
  const { toast } = useToast();
  const { data: course } = useCourse(courseId);
  const { data, isLoading, isError, error } = useCourseQuizData(courseId);
  const c = useMemo(() => (data ? buildConsolidated(data) : null), [data]);

  if (!isTeacher) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <EmptyState
          icon={Lock}
          title="Solo el profesor puede ver esto"
          description="El consolidado es para el profesor dueño del curso."
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
  if (isError || !c) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <EmptyState
          icon={FileText}
          title="No se pudo cargar el consolidado"
          description={error instanceof Error ? error.message : "Intenta de nuevo."}
          action={
            <Button asChild variant="brand">
              <Link to={`/app/courses/${courseId}`}>Volver al curso</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const downloadCsv = () => {
    const blob = new Blob([consolidatedToCsv(c)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "consolidado-quizzes.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast("CSV descargado", "success");
  };

  const attended = c.students.length;
  const enrolled = attended + c.absent.length;

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4 print:max-w-none print:p-0">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link
          to={`/app/courses/${courseId}`}
          className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Volver al curso
        </Link>
        <div className="flex gap-2">
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
          Consolidado de quizzes en vivo · Kódea
        </p>
        <h1 className="text-2xl font-extrabold">Lo mejor de cada estudiante</h1>
        <p className="text-sm text-muted-foreground">
          {course?.title ? `${course.title} · ` : ""}
          Generado el{" "}
          {new Date().toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" })}
        </p>
      </header>

      {c.quizzes.length === 0 ? (
        <Card>
          <CardContent className="p-4 text-sm">Todavía no hay quizzes con respuestas en este curso.</CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardContent className="space-y-2 p-4">
              <h2 className="font-bold">Resumen</h2>
              <p className="text-sm leading-relaxed">
                Se aplicaron {c.quizzes.length} quiz{c.quizzes.length === 1 ? "" : "zes"} en vivo (
                {c.quizzes.map((q) => `«${q.title}»: ${q.questionCount} preguntas en ${q.sessionCount} sesión(es)`).join("; ")}
                ). Participaron {attended} de {enrolled} inscritos
                {c.absent.length > 0 && `; ${c.absent.length} no participó en ninguno`}
                {c.groupAccuracy !== null && `. El acierto del grupo, tomando el mejor intento de cada estudiante en cada pregunta, fue de ${c.groupAccuracy}%`}.
              </p>
              <p className="text-xs text-muted-foreground">
                Cómo se calcula: como algunos estudiantes entraron a varias sesiones o quizzes y avanzaron más en
                unos que en otros, para cada pregunta se toma su <strong>mejor intento</strong> (si la acertó en
                alguna sesión, cuenta como acertada). El porcentaje se calcula solo sobre las preguntas que
                alcanzó a responder, para no castigar a quien se quedó sin tiempo o conexión.
              </p>
            </CardContent>
          </Card>

          {/* Tabla principal */}
          <Card>
            <CardContent className="space-y-3 p-4">
              <h2 className="font-bold">Mejor resultado por estudiante</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="text-muted-foreground">
                    <tr className="border-b">
                      <th className="py-1.5 pr-2 font-semibold">Estudiante</th>
                      {c.quizzes.map((q) => (
                        <th key={q.assignmentId} className="px-2 font-semibold">
                          {q.title}
                        </th>
                      ))}
                      <th className="px-2 font-semibold">Global</th>
                      <th className="px-2 font-semibold">Nivel</th>
                    </tr>
                  </thead>
                  <tbody>
                    {c.students.map((s) => (
                      <tr key={s.id} className="border-b last:border-0">
                        <td className="py-1.5 pr-2 font-medium">{s.name}</td>
                        {c.quizzes.map((q) => {
                          const r = s.perQuiz[q.assignmentId];
                          return (
                            <td
                              key={q.assignmentId}
                              className={cn("px-2 font-semibold", r && r.pct !== null ? pctColor(r.pct) : "text-muted-foreground")}
                            >
                              {r && r.pct !== null ? `${r.pct}% (${r.correct}/${r.answered})` : r ? "—" : "no presentó"}
                            </td>
                          );
                        })}
                        <td className={cn("px-2 font-bold", pctColor(s.accuracy))}>{s.accuracy}%</td>
                        <td className={cn("px-2 font-semibold", LEVEL_COLOR[s.level])}>{s.level}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Alto ≥ 80% · Medio 60–79% · Bajo &lt; 60%. Entre paréntesis: acertadas/respondidas.
              </p>
              {c.absent.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  <span className="font-semibold">No participaron en ningún quiz:</span>{" "}
                  {c.absent.map((a) => a.name).join(", ")}.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Temas del grupo */}
          <Card>
            <CardContent className="space-y-3 p-4">
              <h2 className="font-bold">Temas donde más falla el grupo</h2>
              <div className="space-y-1.5">
                {c.groupTopics.map((t) => (
                  <div key={t.topic} className="space-y-0.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold">{t.topic}</span>
                      <span className={cn("font-semibold", pctColor(t.pct))}>
                        {t.pct}% <span className="font-normal text-muted-foreground">({t.students} estudiantes)</span>
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn("h-full rounded-full", t.pct >= 80 ? "bg-success" : t.pct >= 60 ? "bg-warning" : "bg-destructive")}
                        style={{ width: `${t.pct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              {c.hardestQuestions.length > 0 && (
                <div className="border-t pt-3">
                  <p className="mb-1 text-xs font-semibold text-muted-foreground">Preguntas más difíciles</p>
                  <ul className="space-y-1 text-xs">
                    {c.hardestQuestions.map((q, i) => (
                      <li key={i}>
                        <span className={cn("font-semibold", pctColor(q.pct))}>{q.pct}%</span> · {q.title}{" "}
                        <span className="text-muted-foreground">({q.topic})</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Análisis por estudiante */}
          <h2 className="pt-2 font-bold">Análisis individual</h2>
          {c.students.map((s) => (
            <Card key={s.id} className="print:break-inside-avoid">
              <CardContent className="space-y-2 p-4">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="font-bold">{s.name}</p>
                  <p className={cn("text-xs font-bold", LEVEL_COLOR[s.level])}>
                    {s.accuracy}% · {s.level}
                  </p>
                </div>
                <p className="text-xs leading-relaxed">{s.analysis}</p>

                {s.weaknesses.length > 0 && (
                  <div className="text-xs">
                    <p className="font-semibold text-destructive">Falencias</p>
                    <ul className="list-disc pl-4">
                      {s.weaknesses.map((t) => (
                        <li key={t.topic}>
                          {t.topic}: {t.correct}/{t.answered} ({t.pct}%)
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {s.missed.length > 0 && (
                  <div className="text-xs">
                    <p className="font-semibold text-muted-foreground">
                      Preguntas que no acertó en ningún intento ({s.missed.length})
                    </p>
                    <ul className="list-disc pl-4 text-muted-foreground">
                      {s.missed.slice(0, 8).map((m, i) => (
                        <li key={i}>{m.title}</li>
                      ))}
                      {s.missed.length > 8 && <li>… y {s.missed.length - 8} más</li>}
                    </ul>
                  </div>
                )}
                {s.strengths.length > 0 && (
                  <p className="text-xs">
                    <span className="font-semibold text-success">Fortalezas: </span>
                    {s.strengths.map((t) => `${t.topic} (${t.pct}%)`).join(", ")}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </>
      )}
    </div>
  );
}
