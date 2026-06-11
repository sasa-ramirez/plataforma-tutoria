import { useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { ArrowLeft, Eraser, Pen, Trash2, Radio, Code2, Hand, Share2, Square, Copy, GraduationCap, User } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { useCourse } from "@/hooks/useCourses";
import { useToast } from "@/components/ui/toast";
import {
  getOrCreateBoard,
  fetchStrokes,
  saveStroke,
  clearStrokes,
  saveBoardText,
  setBoardLive,
  type Board,
} from "@/services/board";
import { detectLanguage } from "@/services/runner";
import { STARTER_CODE } from "@/lib/constants";
import { Whiteboard, type WhiteboardHandle, type Segment } from "@/components/board/Whiteboard";
import { CodeRunner } from "@/components/editor/CodeRunner";
import { CodeEditor } from "@/components/editor/CodeEditor";
import { Button } from "@/components/ui/button";
import type { ProgLanguage } from "@/types/database";
import { Card, CardContent } from "@/components/ui/card";
import { FullScreenLoader } from "@/components/common/Spinner";
import { EmptyState } from "@/components/common/EmptyState";
import { cn } from "@/lib/utils";

const COLORS = ["#ffffff", "#22d3ee", "#a855f7", "#f43f5e", "#84cc16", "#f0b429"];
const SIZES = [3, 6, 12];

export function BoardPage() {
  const { id: courseId = "" } = useParams();
  const { isTeacher } = useAuth();
  const { toast } = useToast();
  const { data: course } = useCourse(courseId);

  const [board, setBoard] = useState<Board | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [color, setColor] = useState("#22d3ee");
  const [size, setSize] = useState(6);
  const [mode, setMode] = useState<"pen" | "erase">("pen");
  const [runLang, setRunLang] = useState<ProgLanguage>("python");
  const [allowWrite, setAllowWrite] = useState(false); // permiso (profe)
  const [canWrite, setCanWrite] = useState(false); // permiso recibido (alumno)
  // "Mi código" del alumno: se guarda en su dispositivo para no perderlo.
  const scratchKey = `kodea:scratch:${courseId}`;
  const [personalText, setPersonalText] = useState(() => {
    try {
      return localStorage.getItem(`kodea:scratch:${courseId}`) ?? "";
    } catch {
      return "";
    }
  });
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"pizarra" | "codigo">("pizarra");
  const [codeTab, setCodeTab] = useState<"profe" | "mio">("profe");

  const wbRef = useRef<WhiteboardHandle>(null);
  const personalWbRef = useRef<WhiteboardHandle>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const langTouched = useRef(false); // true si el usuario eligió lenguaje a mano

  // Autodetecta Python/Java del código en vivo (hasta que el usuario elija).
  useEffect(() => {
    if (langTouched.current) return;
    if (text.trim()) setRunLang(detectLanguage(text));
  }, [text]);

  // Persiste "Mi código" en el dispositivo (no se pierde al recargar/salir).
  useEffect(() => {
    try {
      localStorage.setItem(scratchKey, personalText);
    } catch {
      /* almacenamiento no disponible (modo privado) */
    }
  }, [personalText, scratchKey]);

  useEffect(() => {
    let active = true;
    getOrCreateBoard(courseId, isTeacher)
      .then((b) => {
        if (active) {
          setBoard(b);
          setText(b?.text_content ?? "");
          setIsLive(b?.is_live ?? false);
        }
      })
      .catch((e) => active && setError(e instanceof Error ? e.message : "Error"))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [courseId, isTeacher]);

  useEffect(() => {
    if (!board) return;
    let active = true;

    fetchStrokes(board.id).then((s) => {
      if (active) wbRef.current?.loadStrokes(s);
    });

    const channel = supabase
      .channel(`board:${board.course_id}`, {
        config: { broadcast: { self: false } },
      })
      .on("broadcast", { event: "seg" }, ({ payload }) =>
        wbRef.current?.drawSegment(payload as Segment),
      )
      .on("broadcast", { event: "clear" }, () => wbRef.current?.clear())
      .on("broadcast", { event: "text" }, ({ payload }) =>
        setText((payload as { text: string }).text),
      )
      .on("broadcast", { event: "allow" }, ({ payload }) =>
        setCanWrite((payload as { allowed: boolean }).allowed),
      )
      .on("broadcast", { event: "live" }, ({ payload }) =>
        setIsLive((payload as { live: boolean }).live),
      )
      .subscribe();
    channelRef.current = channel;

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [board?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const onSegment = (seg: Segment) =>
    channelRef.current?.send({ type: "broadcast", event: "seg", payload: seg });

  const onStrokeDone = (s: Parameters<NonNullable<typeof saveStroke>>[1]) => {
    // Solo el profesor persiste (los trazos de alumnos son en vivo, RLS lo limita)
    if (board && isTeacher) saveStroke(board.id, s);
  };

  const toggleLive = () => {
    if (!board) return;
    const next = !isLive;
    setIsLive(next);
    setBoardLive(board.id, next).catch(() =>
      toast("No se pudo cambiar la transmisión", "error"),
    );
    channelRef.current?.send({
      type: "broadcast",
      event: "live",
      payload: { live: next },
    });
    if (next) toast("¡Estás en vivo! Se avisó a tus estudiantes 🔴", "success");
  };

  const shareClass = async () => {
    if (!board) return;
    const link = `${window.location.origin}/j/${board.join_code}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: "Entra a la clase en vivo",
          text: `Únete con el código ${board.join_code}`,
          url: link,
        });
      } else {
        await navigator.clipboard.writeText(link);
        toast(`Enlace copiado · código ${board.join_code}`, "success");
      }
    } catch {
      /* el usuario canceló el menú de compartir */
    }
  };

  // Elige lenguaje y, si el área está vacía, carga su código base.
  const pickLang = (l: ProgLanguage, target: "live" | "personal") => {
    langTouched.current = true;
    setRunLang(l);
    if (target === "live" && isTeacher && !text.trim()) onTextChange(STARTER_CODE[l]);
    if (target === "personal" && !personalText.trim()) setPersonalText(STARTER_CODE[l]);
  };

  // Botón "Código base": inserta la plantilla (pide confirmación si hay texto).
  const insertBase = (target: "live" | "personal") => {
    const current = target === "live" ? text : personalText;
    if (current.trim() && !window.confirm("¿Reemplazar lo escrito con el código base?")) {
      return;
    }
    if (target === "live") onTextChange(STARTER_CODE[runLang]);
    else setPersonalText(STARTER_CODE[runLang]);
  };

  // Alumno: lleva el código del profe a su espacio editable.
  const copyToMine = () => {
    if (personalText.trim() && !window.confirm("¿Reemplazar tu código con el del profe?")) {
      return;
    }
    setPersonalText(text);
    setCodeTab("mio");
    toast("Código del profe copiado a tu espacio ✏️", "success");
  };

  const toggleAllowWrite = () => {
    const next = !allowWrite;
    setAllowWrite(next);
    channelRef.current?.send({
      type: "broadcast",
      event: "allow",
      payload: { allowed: next },
    });
  };

  const clearBoard = () => {
    if (!board) return;
    wbRef.current?.clear();
    clearStrokes(board.id);
    channelRef.current?.send({ type: "broadcast", event: "clear", payload: {} });
  };

  const onTextChange = (val: string) => {
    setText(val);
    channelRef.current?.send({
      type: "broadcast",
      event: "text",
      payload: { text: val },
    });
    if (saveTimer.current) clearTimeout(saveTimer.current);
    if (board) {
      const bid = board.id;
      saveTimer.current = setTimeout(() => saveBoardText(bid, val), 800);
    }
  };

  if (loading) return <FullScreenLoader label="Abriendo el tablero…" />;

  if (!board) {
    return (
      <div className="mx-auto max-w-2xl p-4">
        <Link
          to={`/app/courses/${courseId}`}
          className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Volver al curso
        </Link>
        {error || isTeacher ? (
          <EmptyState
            icon={Radio}
            title="No se pudo abrir el tablero"
            description={
              isTeacher
                ? "Solo el profesor que CREÓ este curso puede abrir su tablero. Verifica que sea tu curso."
                : "Hubo un problema al abrir el tablero. Inténtalo de nuevo."
            }
          />
        ) : (
          <EmptyState
            icon={Radio}
            title="El tablero aún no está activo"
            description="Tu profesor todavía no ha abierto el tablero de esta clase. Vuelve cuando inicie."
          />
        )}
        {error && (
          <p className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-center text-xs text-destructive">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon" className="size-9">
          <Link to={`/app/courses/${courseId}`}>
            <ArrowLeft className="size-5" />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-extrabold tracking-tight">
            {course?.title ?? "Tablero en vivo"}
          </h1>
          {isLive ? (
            <p className="flex items-center gap-1.5 text-xs font-semibold text-destructive">
              <span className="relative flex size-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-destructive" />
              </span>
              EN VIVO · Tablero
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Tablero ·{" "}
              {isTeacher
                ? "Sin transmitir todavía"
                : "El profe aún no transmite"}
            </p>
          )}
        </div>

        {isTeacher && (
          <div className="flex items-center gap-2">
            <Button
              variant={isLive ? "destructive" : "brand"}
              size="sm"
              onClick={toggleLive}
            >
              {isLive ? (
                <>
                  <Square className="size-4" /> Detener
                </>
              ) : (
                <>
                  <Radio className="size-4" /> Transmitir
                </>
              )}
            </Button>
            <Button variant="outline" size="sm" onClick={shareClass}>
              <Share2 className="size-4" /> Compartir
            </Button>
          </div>
        )}
      </div>

      {/* Interruptor: Pizarra / Código */}
      <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted/50 p-1">
        <button
          onClick={() => setView("pizarra")}
          className={cn(
            "flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-semibold transition-colors",
            view === "pizarra"
              ? "bg-card text-foreground shadow"
              : "text-muted-foreground",
          )}
        >
          <Pen className="size-4" /> Pizarra
        </button>
        <button
          onClick={() => setView("codigo")}
          className={cn(
            "flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-semibold transition-colors",
            view === "codigo"
              ? "bg-card text-foreground shadow"
              : "text-muted-foreground",
          )}
        >
          <Code2 className="size-4" /> Código
        </button>
      </div>

      {/* ===== VISTA PIZARRA (se oculta pero NO se desmonta) ===== */}
      <div className={cn("space-y-4", view !== "pizarra" && "hidden")}>

      {/* Toolbar (solo profesor) */}
      {isTeacher && (
        <Card>
          <CardContent className="flex flex-wrap items-center gap-2 p-3">
            {COLORS.map((c) => (
              <button
                key={c}
                onClick={() => {
                  setColor(c);
                  setMode("pen");
                }}
                className={cn(
                  "size-7 rounded-full border-2 transition-transform",
                  color === c && mode === "pen"
                    ? "scale-110 border-foreground"
                    : "border-transparent",
                )}
                style={{ background: c }}
                aria-label={`Color ${c}`}
              />
            ))}
            <div className="mx-1 h-6 w-px bg-border" />
            {SIZES.map((s) => (
              <button
                key={s}
                onClick={() => setSize(s)}
                className={cn(
                  "grid size-8 place-items-center rounded-lg",
                  size === s ? "bg-primary/15 text-primary" : "hover:bg-muted",
                )}
                aria-label={`Grosor ${s}`}
              >
                <span
                  className="rounded-full bg-current"
                  style={{ width: s + 2, height: s + 2 }}
                />
              </button>
            ))}
            <div className="mx-1 h-6 w-px bg-border" />
            <Button
              variant={mode === "pen" ? "default" : "outline"}
              size="sm"
              onClick={() => setMode("pen")}
            >
              <Pen className="size-4" /> Lápiz
            </Button>
            <Button
              variant={mode === "erase" ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setMode("erase");
                setSize(40);
              }}
            >
              <Eraser className="size-4" /> Borrador
            </Button>
            <Button
              variant={allowWrite ? "brand" : "outline"}
              size="sm"
              className="ml-auto"
              onClick={toggleAllowWrite}
            >
              <Hand className="size-4" />
              {allowWrite ? "Quitar permiso" : "Permitir que escriban"}
            </Button>
            <Button variant="outline" size="sm" onClick={clearBoard}>
              <Trash2 className="size-4" /> Limpiar
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Aviso al estudiante con permiso */}
      {!isTeacher && canWrite && (
        <div className="rounded-xl border border-success/30 bg-success/5 px-3 py-2 text-sm font-medium text-success">
          ✏️ El profe te dio permiso de escribir en el tablero
        </div>
      )}

      {/* Pizarra */}
      <div className="overflow-hidden rounded-2xl border bg-[#0e0d1a] p-2 surface-glow">
        <Whiteboard
          ref={wbRef}
          readOnly={isTeacher ? false : !canWrite}
          color={color}
          size={mode === "erase" ? 40 : size}
          mode={mode}
          onSegment={onSegment}
          onStrokeDone={onStrokeDone}
        />
      </div>
      </div>
      {/* ===== fin VISTA PIZARRA ===== */}

      {/* ===== VISTA CÓDIGO ===== */}
      {view === "codigo" && (
        <div className="space-y-3">
          {/* Sub-selector Profe/Mío: SOLO el estudiante (el profe solo transmite) */}
          {!isTeacher && (
            <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted/50 p-1">
              <button
                onClick={() => setCodeTab("profe")}
                className={cn(
                  "flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-semibold transition-colors",
                  codeTab === "profe"
                    ? "bg-card text-foreground shadow"
                    : "text-muted-foreground",
                )}
              >
                <GraduationCap className="size-4" /> Código del profe
              </button>
              <button
                onClick={() => setCodeTab("mio")}
                className={cn(
                  "flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-semibold transition-colors",
                  codeTab === "mio"
                    ? "bg-card text-foreground shadow"
                    : "text-muted-foreground",
                )}
              >
                <User className="size-4" /> Mi código
              </button>
            </div>
          )}

          {/* --- Código del profe (en vivo) --- */}
          {codeTab === "profe" && (
            <Card>
              <CardContent className="space-y-3 p-3">
                <div className="flex items-center gap-1.5 text-sm font-bold">
                  <Code2 className="size-4 text-accent" /> Código en vivo
                  {!isTeacher && (
                    <span className="text-xs font-normal text-muted-foreground">
                      (lo escribe tu profe)
                    </span>
                  )}
                </div>
                <CodeEditor
                  value={text}
                  onChange={isTeacher ? onTextChange : () => {}}
                  language={runLang}
                  readOnly={!isTeacher}
                  onReset={isTeacher ? () => insertBase("live") : undefined}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted-foreground">Ejecutar como:</span>
                  {(["python", "java"] as ProgLanguage[]).map((l) => (
                    <button
                      key={l}
                      onClick={() => pickLang(l, "live")}
                      className={cn(
                        "rounded-lg px-2.5 py-1 text-xs font-semibold",
                        runLang === l
                          ? "bg-primary/15 text-primary"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {l === "python" ? "🐍 Python" : "☕ Java"}
                    </button>
                  ))}
                  {!isTeacher && (
                    <button
                      onClick={copyToMine}
                      className="ml-auto flex items-center gap-1 rounded-lg bg-accent/15 px-2.5 py-1 text-xs font-semibold text-accent hover:bg-accent/25"
                    >
                      <Copy className="size-3.5" /> Copiar a mi código
                    </button>
                  )}
                </div>
                <CodeRunner language={runLang} code={text} />
              </CardContent>
            </Card>
          )}

          {/* --- Mi código (privado del estudiante) --- */}
          {!isTeacher && codeTab === "mio" && (
            <Card className="border-accent/30">
              <CardContent className="space-y-3 p-3">
                <div className="flex items-center gap-1.5 text-sm font-bold">
                  <Pen className="size-4 text-accent" /> Mi código
                  <span className="text-xs font-normal text-muted-foreground">
                    (privado — practica mientras sigues la clase)
                  </span>
                </div>
                <CodeEditor
                  value={personalText}
                  onChange={setPersonalText}
                  language={runLang}
                  onReset={() => insertBase("personal")}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted-foreground">Ejecutar como:</span>
                  {(["python", "java"] as ProgLanguage[]).map((l) => (
                    <button
                      key={l}
                      onClick={() => pickLang(l, "personal")}
                      className={cn(
                        "rounded-lg px-2.5 py-1 text-xs font-semibold",
                        runLang === l
                          ? "bg-primary/15 text-primary"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {l === "python" ? "🐍 Python" : "☕ Java"}
                    </button>
                  ))}
                  <button
                    onClick={() => insertBase("personal")}
                    className="ml-auto rounded-lg bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground hover:bg-muted/70"
                  >
                    ↺ Código base
                  </button>
                </div>
                <CodeRunner language={runLang} code={personalText} />
              </CardContent>
            </Card>
          )}
        </div>
      )}
      {/* ===== fin VISTA CÓDIGO ===== */}

      {/* Mi espacio: pizarra privada del ESTUDIANTE (solo en vista Pizarra) */}
      {!isTeacher && (
        <div className={cn(view !== "pizarra" && "hidden")}>
          <Card className="border-accent/30">
            <CardContent className="p-4">
              <div className="mb-1 flex items-center gap-1.5 text-sm font-bold">
                <Pen className="size-4 text-accent" /> Mi espacio
                <span className="text-xs font-normal text-muted-foreground">
                  (privado — dibuja mientras sigues la clase)
                </span>
              </div>
              <div className="my-3 overflow-hidden rounded-2xl border bg-[#0e0d1a] p-2">
                <Whiteboard
                  ref={personalWbRef}
                  color={color}
                  size={mode === "erase" ? 40 : size}
                  mode={mode}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
