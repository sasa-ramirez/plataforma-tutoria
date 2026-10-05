import { useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  BookOpenCheck,
  ChevronDown,
  ClipboardCheck,
  FileText,
  Presentation,
  Trash2,
  Upload,
} from "lucide-react";
import { EmptyState } from "@/components/common/EmptyState";
import { FullScreenLoader, Spinner } from "@/components/common/Spinner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import {
  useStudySpace,
  useStudyDocuments,
  useStudyNotes,
  useProcessStudyDocument,
  useDeleteStudyDocument,
  useDeleteStudySpace,
  useStudyExams,
  useDeleteStudyExam,
} from "@/hooks/useStudy";
import { StartExamDialog } from "@/components/study/StartExamDialog";
import { MAX_DOC_CHARS } from "@/lib/studyText";
import type { ProcessProgress, StudyDocument, StudyExam, StudyNote } from "@/services/study";
import { cn } from "@/lib/utils";

const PHASE_TEXT: Record<ProcessProgress["phase"], string> = {
  reading: "Leyendo el archivo",
  summarizing: "Armando las notas",
  saving: "Guardando",
};

/** Una materia: sube documentos y revisa las notas por tema que salen de ellos. */
export function StudySpacePage() {
  const { spaceId = "" } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: space, isLoading } = useStudySpace(spaceId);
  const { data: docs, isLoading: docsLoading } = useStudyDocuments(spaceId);
  const { data: notes } = useStudyNotes(spaceId);
  const { mutateAsync: processDoc } = useProcessStudyDocument(space);
  const { mutateAsync: deleteDoc } = useDeleteStudyDocument(spaceId);
  const { mutateAsync: deleteSpace } = useDeleteStudySpace();
  const inputRef = useRef<HTMLInputElement>(null);
  const [current, setCurrent] = useState<{ name: string; p: ProcessProgress; i: number; n: number } | null>(
    null,
  );
  const [dragOver, setDragOver] = useState(false);
  const busy = current !== null;

  const notesByDoc = useMemo(() => {
    const m = new Map<string, StudyNote[]>();
    for (const n of notes ?? []) m.set(n.document_id, [...(m.get(n.document_id) ?? []), n]);
    return m;
  }, [notes]);

  const topicCount = useMemo(
    () => new Set((notes ?? []).map((n) => n.topic.trim().toLowerCase())).size,
    [notes],
  );

  const onFiles = async (list: FileList | File[]) => {
    const files = Array.from(list);
    if (files.length === 0 || busy) return;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setCurrent({ name: file.name, p: { phase: "reading", done: 0, total: 1 }, i, n: files.length });
      try {
        const d = await processDoc({
          file,
          onProgress: (p) => setCurrent({ name: file.name, p, i, n: files.length }),
        });
        if (d.status === "error") toast(`${file.name}: ${d.error}`, "error");
        else if (d.error) toast(`${file.name}: ${d.error}`, "info");
        else toast(`Listo: ${file.name}`, "success");
      } catch (e) {
        toast(`${file.name}: ${e instanceof Error ? e.message : "no se pudo procesar"}`, "error");
      }
    }
    setCurrent(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleDeleteDoc = async (d: StudyDocument) => {
    if (!window.confirm(`¿Borrar "${d.file_name}" y sus notas?`)) return;
    try {
      await deleteDoc(d.id);
    } catch (e) {
      toast(e instanceof Error ? e.message : "No se pudo borrar", "error");
    }
  };

  const handleDeleteSpace = async () => {
    if (!space) return;
    if (!window.confirm(`¿Borrar la materia "${space.title}" con todos sus documentos y notas?`)) return;
    try {
      await deleteSpace(space.id);
      navigate("/app/study");
    } catch (e) {
      toast(e instanceof Error ? e.message : "No se pudo borrar", "error");
    }
  };

  if (isLoading) return <FullScreenLoader />;
  if (!space) {
    return (
      <EmptyState
        icon={BookOpenCheck}
        title="Materia no encontrada"
        description="Puede que la hayas borrado."
        action={
          <Button asChild variant="brand">
            <Link to="/app/study">Volver</Link>
          </Button>
        }
      />
    );
  }

  const pct = current
    ? current.p.phase === "reading"
      ? Math.round((current.p.done / Math.max(1, current.p.total)) * 15)
      : 15 + Math.round((current.p.done / Math.max(1, current.p.total)) * 85)
    : 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2">
        <Link
          to="/app/study"
          className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Mis materias
        </Link>
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={handleDeleteSpace}
        >
          <Trash2 className="size-4" /> Borrar materia
        </Button>
      </div>

      <h1 className="text-2xl font-extrabold tracking-tight">{space.title}</h1>

      {/* Subir documentos */}
      <Card>
        <CardContent className="p-4">
          <label
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              void onFiles(e.dataTransfer.files);
            }}
            className={cn(
              "flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed p-6 text-center transition-colors",
              dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/40",
              busy && "pointer-events-none opacity-60",
            )}
          >
            <Upload className="size-6 text-primary" />
            <span className="text-sm font-semibold">Sube tus PDF o PowerPoint</span>
            <span className="text-xs text-muted-foreground">
              .pdf o .pptx · hasta 20 MB cada uno · la lectura se hace en tu dispositivo
            </span>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept=".pdf,.pptx,application/pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation"
              className="sr-only"
              disabled={busy}
              onChange={(e) => e.target.files && void onFiles(e.target.files)}
            />
          </label>

          {current && (
            <div className="mt-4 space-y-1.5">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="min-w-0 truncate font-semibold">
                  {current.n > 1 ? `(${current.i + 1}/${current.n}) ` : ""}
                  {current.name}
                </span>
                <span className="shrink-0 text-muted-foreground">
                  {PHASE_TEXT[current.p.phase]}
                  {current.p.phase === "summarizing" ? ` · ${current.p.done}/${current.p.total}` : ""}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
              </div>
              <p className="text-[11px] text-muted-foreground">
                No cierres esta pantalla hasta que termine; los documentos largos tardan un poco.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Parcial simulado */}
      <ExamsSection spaceId={spaceId} topicCount={topicCount} hasNotes={(notes?.length ?? 0) > 0} />

      {/* Documentos y sus notas */}
      {docsLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : !docs || docs.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Todavía no hay documentos"
          description="Sube el primero y aquí aparecerán sus notas por tema."
        />
      ) : (
        <div className="space-y-3">
          <h2 className="font-bold">Documentos y notas</h2>
          {docs.map((d) => (
            <DocumentCard
              key={d.id}
              doc={d}
              notes={notesByDoc.get(d.id) ?? []}
              interrupted={d.status === "processing" && !busy}
              onDelete={() => handleDeleteDoc(d)}
            />
          ))}
          {busy && <Spinner className="mx-auto size-5 text-primary" />}
        </div>
      )}
    </div>
  );
}

const DIFF_LABEL: Record<string, string> = {
  mixed: "variado",
  easy: "fácil",
  medium: "medio",
  hard: "difícil",
};

/** Crear un parcial simulado y ver los anteriores. */
function ExamsSection({
  spaceId,
  topicCount,
  hasNotes,
}: {
  spaceId: string;
  topicCount: number;
  hasNotes: boolean;
}) {
  const { toast } = useToast();
  const { data: exams } = useStudyExams(spaceId);
  const { mutateAsync: removeExam } = useDeleteStudyExam(spaceId);

  const handleDelete = async (e: StudyExam) => {
    if (!window.confirm(`¿Borrar "${e.title}"?`)) return;
    try {
      await removeExam(e.id);
    } catch (err) {
      toast(err instanceof Error ? err.message : "No se pudo borrar", "error");
    }
  };

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="flex items-center gap-1.5 font-bold">
              <ClipboardCheck className="size-4 text-primary" /> Parcial simulado
            </h2>
            <p className="text-xs text-muted-foreground">
              {hasNotes
                ? "Preguntas de todos tus temas, con repaso y explicación al final."
                : "Sube y procesa al menos un documento para poder armar un parcial."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {(exams ?? []).some((e) => e.status === "finished") && (
              <Button asChild variant="outline">
                <Link to={`/app/study/${spaceId}/report`}>
                  <BarChart3 className="size-4" /> Mi informe
                </Link>
              </Button>
            )}
            <StartExamDialog spaceId={spaceId} topicCount={topicCount} disabled={!hasNotes} />
          </div>
        </div>

        {exams && exams.length > 0 && (
          <div className="space-y-2 border-t pt-3">
            {exams.map((e) => {
              const pct =
                e.status === "finished" && e.correct_count !== null
                  ? Math.round((e.correct_count / e.question_count) * 100)
                  : null;
              return (
                <div key={e.id} className="flex items-center gap-2">
                  <Link
                    to={`/app/study/${spaceId}/exam/${e.id}`}
                    className="flex min-w-0 flex-1 items-center gap-3 rounded-xl border p-2.5 hover:bg-muted/50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{e.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {e.question_count} preguntas · {DIFF_LABEL[e.difficulty]} ·{" "}
                        {new Date(e.created_at).toLocaleDateString("es-CO", { day: "2-digit", month: "short" })}
                      </p>
                    </div>
                    {pct !== null ? (
                      <Badge variant={pct >= 70 ? "success" : pct >= 50 ? "warning" : "destructive"}>{pct}%</Badge>
                    ) : (
                      <Badge variant="warning">Continuar</Badge>
                    )}
                  </Link>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0"
                    onClick={() => handleDelete(e)}
                    aria-label="Borrar parcial"
                  >
                    <Trash2 className="size-4 text-muted-foreground" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DocumentCard({
  doc,
  notes,
  interrupted,
  onDelete,
}: {
  doc: StudyDocument;
  notes: StudyNote[];
  interrupted: boolean;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const Icon = doc.kind === "pdf" ? FileText : Presentation;
  const unit = doc.kind === "pdf" ? "página" : "diapositiva";

  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          <Icon className="size-5" />
        </div>
        <button
          type="button"
          onClick={() => notes.length > 0 && setOpen((v) => !v)}
          className="min-w-0 flex-1 text-left"
        >
          <p className="truncate text-sm font-semibold">{doc.file_name}</p>
          <p className="text-xs text-muted-foreground">
            {doc.page_count} {unit}
            {doc.page_count === 1 ? "" : "s"} · {notes.length} tema{notes.length === 1 ? "" : "s"}
          </p>
        </button>
        {interrupted ? (
          <Badge variant="destructive">Interrumpido</Badge>
        ) : doc.status === "processing" ? (
          <Badge variant="warning">Procesando</Badge>
        ) : doc.status === "error" ? (
          <Badge variant="destructive">Falló</Badge>
        ) : (
          <Badge variant="success">Listo</Badge>
        )}
        {notes.length > 0 && (
          <ChevronDown
            className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
          />
        )}
        <Button variant="ghost" size="icon" className="size-8 shrink-0" onClick={onDelete} aria-label="Borrar documento">
          <Trash2 className="size-4 text-muted-foreground" />
        </Button>
      </div>

      {interrupted && (
        <p className="mt-2 flex items-start gap-1.5 text-xs text-destructive">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          Se interrumpió antes de terminar. Bórralo y vuelve a subirlo.
        </p>
      )}
      {doc.error && !interrupted && (
        <p className="mt-2 flex items-start gap-1.5 text-xs text-warning">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          {doc.error}
        </p>
      )}
      {doc.truncated && (
        <p className="mt-2 flex items-start gap-1.5 text-xs text-warning">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          Era muy largo: se leyeron los primeros {Math.round(MAX_DOC_CHARS / 1000)} mil caracteres. Sube el resto en otro archivo.
        </p>
      )}

      {open && (
        <div className="mt-3 space-y-3 border-t pt-3">
          {notes.map((n) => (
            <div key={n.id} className="space-y-1">
              <p className="text-sm font-bold">{n.topic}</p>
              <p className="text-xs leading-relaxed text-muted-foreground">{n.summary}</p>
              {n.key_points.length > 0 && (
                <ul className="list-disc space-y-0.5 pl-5 text-xs">
                  {n.key_points.map((k, i) => (
                    <li key={i}>{k}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
