import { useMemo, useState } from "react";
import { ClipboardPaste, ListPlus, Plus, Trash2, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/common/Spinner";
import { useToast } from "@/components/ui/toast";
import { useCreateQuizBatch } from "@/hooks/useAssignments";
import { parseQuizText } from "@/lib/quizPaste";
import { titleFromQuestion } from "@/lib/quizText";
import { cn } from "@/lib/utils";
import type { Assignment } from "@/types/database";

const MIN_OPTIONS = 2;
const MAX_OPTIONS = 6;
const MAX_QUESTIONS = 60;

interface Draft {
  id: string;
  question: string;
  options: string[];
  correct: number | null;
}

const newDraft = (): Draft => ({
  id: crypto.randomUUID(),
  question: "",
  options: ["", "", "", ""],
  correct: null,
});

const isBlank = (d: Draft) => !d.question.trim() && d.options.every((o) => !o.trim());
const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

/** Qué le falta a una pregunta para poder guardarse (lista vacía = lista). */
function problems(d: Draft): string[] {
  const out: string[] = [];
  if (!d.question.trim()) out.push("Escribe la pregunta");
  const filled = d.options.map((o) => o.trim()).filter(Boolean);
  if (filled.length < MIN_OPTIONS) out.push("Pon al menos 2 opciones");
  if (new Set(filled.map(norm)).size !== filled.length) out.push("Hay opciones repetidas");
  if (d.correct === null || !d.options[d.correct]?.trim()) out.push("Marca cuál es la correcta");
  return out;
}

/** El tutor crea VARIAS preguntas de opción múltiple de una vez (escribiéndolas
 * o pegando el texto de un Word) y se guardan juntas como un solo quiz,
 * agrupado igual que las que genera la IA. */
export function ManualQuizDialog({ assignment }: { assignment: Assignment }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState("");
  const [drafts, setDrafts] = useState<Draft[]>(() => [newDraft()]);
  const [showErrors, setShowErrors] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [focusId, setFocusId] = useState<string | null>(null);
  const { mutateAsync, isPending } = useCreateQuizBatch(assignment.id);

  const filled = useMemo(() => drafts.filter((d) => !isBlank(d)), [drafts]);
  const ready = useMemo(() => filled.filter((d) => problems(d).length === 0), [filled]);
  const hasContent = filled.length > 0 || !!topic.trim();

  const reset = () => {
    setTopic("");
    setDrafts([newDraft()]);
    setShowErrors(false);
    setPasteOpen(false);
    setPasteText("");
  };

  const handleOpenChange = (v: boolean) => {
    if (!v && !isPending && hasContent && !window.confirm("¿Cerrar sin guardar? Se perderán las preguntas que escribiste.")) {
      return;
    }
    setOpen(v);
    if (!v) reset();
  };

  const update = (id: string, patch: Partial<Draft>) =>
    setDrafts((ds) => ds.map((d) => (d.id === id ? { ...d, ...patch } : d)));

  const setOption = (id: string, i: number, value: string) =>
    setDrafts((ds) =>
      ds.map((d) => (d.id === id ? { ...d, options: d.options.map((o, k) => (k === i ? value : o)) } : d)),
    );

  const addOption = (id: string) =>
    setDrafts((ds) =>
      ds.map((d) => (d.id === id && d.options.length < MAX_OPTIONS ? { ...d, options: [...d.options, ""] } : d)),
    );

  const removeOption = (id: string, i: number) =>
    setDrafts((ds) =>
      ds.map((d) => {
        if (d.id !== id || d.options.length <= MIN_OPTIONS) return d;
        const options = d.options.filter((_, k) => k !== i);
        // La marca de "correcta" sigue a su opción aunque cambien las posiciones.
        const correct = d.correct === null ? null : d.correct === i ? null : d.correct > i ? d.correct - 1 : d.correct;
        return { ...d, options, correct };
      }),
    );

  const addQuestion = () => {
    if (drafts.length >= MAX_QUESTIONS) {
      toast(`Máximo ${MAX_QUESTIONS} preguntas por quiz. Guarda este y crea otro.`, "error");
      return;
    }
    const d = newDraft();
    setDrafts((ds) => [...ds, d]);
    setFocusId(d.id);
  };

  const removeQuestion = (id: string) =>
    setDrafts((ds) => {
      const left = ds.filter((d) => d.id !== id);
      return left.length > 0 ? left : [newDraft()];
    });

  const importPasted = () => {
    const { questions, warnings } = parseQuizText(pasteText);
    if (questions.length === 0) {
      toast("No encontré preguntas en ese texto. Revisa que cada una tenga sus opciones (a, b, c…).", "error");
      return;
    }
    const added: Draft[] = questions.map((q) => ({
      id: crypto.randomUUID(),
      question: q.question,
      options: q.options.slice(0, MAX_OPTIONS),
      correct: q.correct,
    }));
    // La tarjeta en blanco inicial se reemplaza en vez de quedar sobrando.
    setDrafts((ds) => [...ds.filter((d) => !isBlank(d)), ...added].slice(0, MAX_QUESTIONS));
    setPasteText("");
    setPasteOpen(false);
    const noKey = added.filter((d) => d.correct === null).length;
    toast(
      `Se leyeron ${added.length} pregunta${added.length === 1 ? "" : "s"}.` +
        (noKey > 0 ? ` Marca la correcta en ${noKey}.` : "") +
        (warnings.length > 0 ? ` ${warnings[0]}` : ""),
      noKey > 0 || warnings.length > 0 ? "info" : "success",
    );
  };

  const save = async () => {
    setShowErrors(true);
    if (filled.length === 0) {
      toast("Escribe al menos una pregunta.", "error");
      return;
    }
    const bad = filled.length - ready.length;
    if (bad > 0) {
      toast(`Faltan datos en ${bad} pregunta${bad === 1 ? "" : "s"} (marcadas en rojo).`, "error");
      return;
    }
    try {
      const created = await mutateAsync({
        assignmentId: assignment.id,
        language: assignment.language,
        difficulty: assignment.difficulty,
        topic: topic.trim() || "Preguntas manuales",
        questions: ready.map((d) => {
          // Se guardan solo las opciones con texto; la correcta se reubica en la lista limpia.
          const kept = d.options.map((o, i) => ({ o: o.trim(), i })).filter((x) => x.o);
          // Se conservan los saltos de línea y la sangría (preguntas con código).
          const question = d.question.replace(/[ \t]+$/gm, "").trim();
          return {
            title: titleFromQuestion(question),
            prompt: question.length <= 100 && !question.includes("\n") ? "" : question,
            options: kept.map((x) => x.o),
            correct: kept.findIndex((x) => x.i === d.correct),
          };
        }),
      });
      toast(`Se agregaron ${created} pregunta${created === 1 ? "" : "s"} al quiz`, "success");
      setOpen(false);
      reset();
    } catch (e) {
      toast(e instanceof Error ? e.message : "No se pudo guardar el quiz", "error");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <ListPlus className="size-4" /> Crear quiz
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 p-0 sm:max-w-2xl">
        <DialogHeader className="border-b p-5 pb-4">
          <DialogTitle>Crear preguntas de opción múltiple</DialogTitle>
          <DialogDescription>
            Escribe todas las que quieras de una vez, o pégalas desde un Word. Se guardan juntas como un solo quiz.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          <div className="space-y-2">
            <Label htmlFor="mq-topic">Nombre del quiz o tema (opcional)</Label>
            <Input
              id="mq-topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Ej. Repaso unidad 2"
              maxLength={80}
            />
          </div>

          {/* Pegar desde Word / texto */}
          <div className="rounded-xl border border-dashed p-3">
            <button
              type="button"
              onClick={() => setPasteOpen((v) => !v)}
              className="flex w-full items-center gap-2 text-left text-sm font-semibold text-primary"
            >
              <ClipboardPaste className="size-4" /> Pegar preguntas desde un Word o texto
            </button>
            {pasteOpen && (
              <div className="mt-3 space-y-2">
                <Textarea
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  rows={8}
                  className="font-mono text-xs"
                  placeholder={`1. ¿Capital de Francia?\na) Madrid\nb) París *\nc) Roma\nd) Berlín\n\n2. ¿Cuánto es 2+2?\na) 3\nb) 4\nc) 5\nRespuesta: B`}
                />
                <p className="text-[11px] text-muted-foreground">
                  Marca la correcta con * o ✓ al final de la opción, o con una línea «Respuesta: B». Separa las
                  preguntas con una línea en blanco o numerándolas. Podrás corregir todo después.
                </p>
                <Button size="sm" variant="brand" onClick={importPasted} disabled={!pasteText.trim()}>
                  Agregar al quiz
                </Button>
              </div>
            )}
          </div>

          {/* Tarjetas de preguntas */}
          <div className="space-y-3">
            {drafts.map((d, qi) => {
              const errs = showErrors && !isBlank(d) ? problems(d) : [];
              return (
                <div
                  key={d.id}
                  className={cn("space-y-3 rounded-2xl border p-3", errs.length > 0 && "border-destructive/60 bg-destructive/5")}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-muted-foreground">Pregunta {qi + 1}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      onClick={() => removeQuestion(d.id)}
                      aria-label={`Borrar pregunta ${qi + 1}`}
                    >
                      <Trash2 className="size-4 text-muted-foreground" />
                    </Button>
                  </div>

                  <Textarea
                    value={d.question}
                    onChange={(e) => update(d.id, { question: e.target.value })}
                    placeholder="Escribe la pregunta…"
                    rows={Math.min(10, Math.max(2, d.question.split("\n").length))}
                    className="min-h-[60px]"
                    autoFocus={focusId === d.id}
                  />

                  <div className="space-y-2">
                    {d.options.map((o, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input
                          type="radio"
                          name={`correct-${d.id}`}
                          checked={d.correct === i}
                          onChange={() => update(d.id, { correct: i })}
                          className="size-4 shrink-0 accent-primary"
                          aria-label={`Marcar la opción ${String.fromCharCode(65 + i)} como correcta`}
                          title="Marcar como correcta"
                        />
                        <span className="w-4 shrink-0 text-xs font-bold text-muted-foreground">
                          {String.fromCharCode(65 + i)}
                        </span>
                        <Input
                          value={o}
                          onChange={(e) => setOption(d.id, i, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key !== "Enter") return;
                            e.preventDefault();
                            const inputs = e.currentTarget.closest("div.space-y-2")?.querySelectorAll<HTMLInputElement>('input[type="text"], input:not([type])');
                            const next = inputs?.[i + 1];
                            if (next) next.focus();
                            else if (qi === drafts.length - 1) addQuestion(); // Enter en la última opción: siguiente pregunta
                          }}
                          placeholder={`Opción ${String.fromCharCode(65 + i)}`}
                          className="h-10"
                        />
                        {d.options.length > MIN_OPTIONS && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-7 shrink-0"
                            onClick={() => removeOption(d.id, i)}
                            aria-label={`Quitar la opción ${String.fromCharCode(65 + i)}`}
                          >
                            <X className="size-4 text-muted-foreground" />
                          </Button>
                        )}
                      </div>
                    ))}
                    {d.options.length < MAX_OPTIONS && (
                      <button
                        type="button"
                        onClick={() => addOption(d.id)}
                        className="text-xs font-semibold text-primary hover:underline"
                      >
                        + Agregar opción
                      </button>
                    )}
                  </div>

                  {errs.length > 0 && <p className="text-xs font-medium text-destructive">{errs.join(" · ")}</p>}
                </div>
              );
            })}
          </div>

          <Button type="button" variant="outline" className="w-full" onClick={addQuestion}>
            <Plus className="size-4" /> Agregar otra pregunta
          </Button>
        </div>

        <div className="flex items-center justify-between gap-3 border-t p-4">
          <p className="text-xs text-muted-foreground">
            {filled.length === 0
              ? "Aún no hay preguntas"
              : `${ready.length} lista${ready.length === 1 ? "" : "s"}${filled.length > ready.length ? ` · ${filled.length - ready.length} por completar` : ""}`}
          </p>
          <Button variant="brand" onClick={save} disabled={isPending || filled.length === 0}>
            {isPending ? <Spinner className="size-4" /> : null}
            Guardar {filled.length > 0 ? `${filled.length} pregunta${filled.length === 1 ? "" : "s"}` : "quiz"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
