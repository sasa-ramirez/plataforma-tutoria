import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowDownRight,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  ClipboardCheck,
  Lightbulb,
  Printer,
  Target,
  XCircle,
} from "lucide-react";
import { EmptyState } from "@/components/common/EmptyState";
import { FullScreenLoader } from "@/components/common/Spinner";
import { StartExamDialog } from "@/components/study/StartExamDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useStudyNotes, useStudyReportData, useStudySpace } from "@/hooks/useStudy";
import { buildStudyReport, type TopicLevel, type TopicStat, type Trend } from "@/lib/studyReport";
import { cn } from "@/lib/utils";

const LEVEL_LABEL: Record<TopicLevel, string> = {
  dominado: "Dominado",
  progreso: "En progreso",
  debil: "Reforzar",
};
const LEVEL_VARIANT: Record<TopicLevel, "success" | "warning" | "destructive"> = {
  dominado: "success",
  progreso: "warning",
  debil: "destructive",
};
const BAR_COLOR: Record<TopicLevel, string> = {
  dominado: "bg-success",
  progreso: "bg-warning",
  debil: "bg-destructive",
};

function TrendIcon({ trend }: { trend: Trend | null }) {
  if (trend === "up") return <ArrowUpRight className="size-3.5 text-success" aria-label="Mejorando" />;
  if (trend === "down") return <ArrowDownRight className="size-3.5 text-destructive" aria-label="Empeorando" />;
  if (trend === "flat") return <ArrowRight className="size-3.5 text-muted-foreground" aria-label="Igual" />;
  return null;
}

/** Informe de falencias de una materia: en qué temas va bien, en cuáles
 * está flojo y qué preguntas falló, con un atajo a un parcial de refuerzo. */
export function StudyReportPage() {
  const { spaceId = "" } = useParams();
  const { data: space } = useStudySpace(spaceId);
  const { data, isLoading } = useStudyReportData(spaceId);
  const { data: notes } = useStudyNotes(spaceId);

  const report = useMemo(
    () => (data ? buildStudyReport(data.exams, data.questions) : null),
    [data],
  );

  // Puntos clave de las notas, por tema, para el "repasa esto" de los temas débiles.
  const notesByTopic = useMemo(() => {
    const m = new Map<string, { summary: string; points: string[] }>();
    for (const n of notes ?? []) {
      const key = n.topic.trim().toLowerCase();
      const cur = m.get(key);
      m.set(key, {
        summary: cur ? cur.summary : n.summary,
        points: [...(cur?.points ?? []), ...n.key_points].slice(0, 6),
      });
    }
    return m;
  }, [notes]);

  const topicCount = useMemo(
    () => new Set((notes ?? []).map((n) => n.topic.trim().toLowerCase())).size,
    [notes],
  );

  if (isLoading) return <FullScreenLoader />;

  const back = (
    <Link
      to={`/app/study/${spaceId}`}
      className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground print:hidden"
    >
      <ArrowLeft className="size-4" /> Volver a la materia
    </Link>
  );

  if (!report || report.examCount === 0) {
    return (
      <div className="space-y-4">
        {back}
        <EmptyState
          icon={BarChart3}
          title="Aún no hay informe"
          description="Termina al menos un parcial simulado y aquí verás en qué temas vas bien y en cuáles debes reforzar."
          action={
            <Button asChild variant="brand">
              <Link to={`/app/study/${spaceId}`}>Ir a la materia</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const weakNames = report.weak.map((t) => t.topic);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-center justify-between gap-2">
        {back}
        <Button variant="outline" size="sm" className="print:hidden" onClick={() => window.print()}>
          <Printer className="size-4" /> Imprimir / PDF
        </Button>
      </div>

      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Informe de falencias · Kódea
        </p>
        <h1 className="text-2xl font-extrabold">{space?.title ?? "Materia"}</h1>
        <p className="text-sm text-muted-foreground">
          Basado en {report.examCount} parcial{report.examCount === 1 ? "" : "es"} ·{" "}
          {report.totalQuestions} preguntas
        </p>
      </header>

      {/* Cifras */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-extrabold">{report.avgPct}%</p>
            <p className="text-[11px] text-muted-foreground">promedio general</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-extrabold">{report.lastPct}%</p>
            <p className="text-[11px] text-muted-foreground">último parcial</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p
              className={cn(
                "text-2xl font-extrabold",
                report.delta === null
                  ? "text-muted-foreground"
                  : report.delta > 0
                    ? "text-success"
                    : report.delta < 0
                      ? "text-destructive"
                      : "",
              )}
            >
              {report.delta === null ? "—" : `${report.delta > 0 ? "+" : ""}${report.delta}`}
            </p>
            <p className="text-[11px] text-muted-foreground">puntos vs. el primero</p>
          </CardContent>
        </Card>
      </div>

      {/* Qué hacer */}
      <Card>
        <CardContent className="space-y-2 p-4">
          <h2 className="flex items-center gap-1.5 font-bold">
            <Lightbulb className="size-4 text-primary" /> Qué te recomendamos
          </h2>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {report.recommendations.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
          {weakNames.length > 0 && (
            <div className="pt-1 print:hidden">
              <StartExamDialog
                spaceId={spaceId}
                topicCount={topicCount}
                focus={weakNames}
                defaultCount={10}
                label="Parcial de mis temas débiles"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Evolución por parcial */}
      {report.exams.length > 1 && (
        <Card>
          <CardContent className="space-y-2 p-4">
            <h2 className="font-bold">Tu evolución</h2>
            {report.exams.map((e) => (
              <div key={e.id} className="space-y-0.5">
                <div className="flex justify-between text-xs">
                  <span className="truncate font-medium">
                    {e.title} ·{" "}
                    <span className="text-muted-foreground">
                      {new Date(e.date).toLocaleDateString("es-CO", { day: "2-digit", month: "short" })}
                    </span>
                  </span>
                  <span className="shrink-0 font-semibold">
                    {e.correct}/{e.total} · {e.pct}%
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn("h-full rounded-full", e.pct >= 70 ? "bg-success" : e.pct >= 50 ? "bg-warning" : "bg-destructive")}
                    style={{ width: `${e.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Todos los temas */}
      <Card>
        <CardContent className="space-y-3 p-4">
          <h2 className="font-bold">Cómo vas por tema</h2>
          {report.topics.map((t) => (
            <div key={t.topic} className="space-y-1">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="flex min-w-0 items-center gap-1.5 font-semibold">
                  <span className="truncate">{t.topic}</span>
                  <TrendIcon trend={t.trend} />
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {t.correct}/{t.seen}
                    {t.lowData ? " · pocos datos" : ""}
                  </span>
                  <Badge variant={LEVEL_VARIANT[t.level]}>{t.pct}%</Badge>
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div className={cn("h-full rounded-full", BAR_COLOR[t.level])} style={{ width: `${t.pct}%` }} />
              </div>
            </div>
          ))}
          <p className="text-[11px] text-muted-foreground">
            Dominado desde 80% · En progreso 60–79% · Reforzar por debajo de 60%. La flecha compara tu último
            parcial con los anteriores.
          </p>
        </CardContent>
      </Card>

      {/* Temas a reforzar, con lo que falló y qué repasar */}
      {report.weak.length > 0 && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-1.5 font-bold">
            <Target className="size-4 text-destructive" /> Temas a reforzar
          </h2>
          {report.weak.map((t) => (
            <WeakTopicCard key={t.topic} topic={t} review={notesByTopic.get(t.topic.trim().toLowerCase())} />
          ))}
        </section>
      )}

      {report.strong.length > 0 && (
        <Card>
          <CardContent className="space-y-2 p-4">
            <h2 className="flex items-center gap-1.5 font-bold">
              <CheckCircle2 className="size-4 text-success" /> Lo que ya dominas
            </h2>
            <div className="flex flex-wrap gap-1.5">
              {report.strong.map((t) => (
                <Badge key={t.topic} variant="success">
                  {t.topic} · {t.pct}%
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <p className="flex items-center justify-center gap-1.5 pb-2 text-[11px] text-muted-foreground print:hidden">
        <ClipboardCheck className="size-3.5" /> El informe se actualiza solo cada vez que terminas un parcial.
      </p>
    </div>
  );
}

function WeakTopicCard({
  topic: t,
  review,
}: {
  topic: TopicStat;
  review: { summary: string; points: string[] } | undefined;
}) {
  return (
    <Card className="print:break-inside-avoid">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="font-bold">{t.topic}</p>
          <Badge variant="destructive">
            {t.pct}% · {t.correct}/{t.seen}
          </Badge>
        </div>

        {review && (
          <div className="rounded-xl bg-muted/50 p-3 text-xs">
            <p className="mb-1 font-semibold">Repasa esto</p>
            <p className="leading-relaxed text-muted-foreground">{review.summary}</p>
            {review.points.length > 0 && (
              <ul className="mt-1.5 list-disc space-y-0.5 pl-4">
                {review.points.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {t.missed.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">Preguntas que fallaste</p>
            {t.missed.map((q, i) => (
              <div key={i} className="space-y-1 rounded-xl border p-2.5 text-xs">
                <p className="flex items-start gap-1.5 font-semibold">
                  <XCircle className="mt-0.5 size-3.5 shrink-0 text-destructive" />
                  {q.question}
                </p>
                {q.selected !== null && (
                  <p className="text-destructive">Tu respuesta: {q.options[q.selected]}</p>
                )}
                {q.selected === null && <p className="italic text-muted-foreground">Sin responder</p>}
                <p className="text-success">Correcta: {q.options[q.correct]}</p>
                {q.explanation && <p className="text-muted-foreground">{q.explanation}</p>}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
