import { useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { ArrowLeft, Eraser, Pen, Trash2, Radio, Code2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import {
  getOrCreateBoard,
  fetchStrokes,
  saveStroke,
  clearStrokes,
  saveBoardText,
  type Board,
} from "@/services/board";
import { Whiteboard, type WhiteboardHandle, type Segment } from "@/components/board/Whiteboard";
import { CodeRunner } from "@/components/editor/CodeRunner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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

  const [board, setBoard] = useState<Board | null>(null);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [color, setColor] = useState("#22d3ee");
  const [size, setSize] = useState(6);
  const [mode, setMode] = useState<"pen" | "erase">("pen");
  const [runLang, setRunLang] = useState<ProgLanguage>("python");

  const wbRef = useRef<WhiteboardHandle>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let active = true;
    getOrCreateBoard(courseId, isTeacher)
      .then((b) => {
        if (active) {
          setBoard(b);
          setText(b?.text_content ?? "");
        }
      })
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
    if (board) saveStroke(board.id, s);
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
        <EmptyState
          icon={Radio}
          title="El tablero aún no está activo"
          description="Tu profesor todavía no ha abierto el tablero de esta clase. Vuelve cuando inicie."
        />
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
        <div className="flex-1">
          <h1 className="text-xl font-extrabold tracking-tight">Tablero en vivo</h1>
          <p className="flex items-center gap-1.5 text-xs text-success">
            <span className="relative flex size-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-success" />
            </span>
            {isTeacher ? "Estás transmitiendo" : "En vivo"}
          </p>
        </div>
      </div>

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
              variant="outline"
              size="sm"
              className="ml-auto"
              onClick={clearBoard}
            >
              <Trash2 className="size-4" /> Limpiar
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Pizarra */}
      <div className="overflow-hidden rounded-2xl border bg-[#0e0d1a] p-2 surface-glow">
        <Whiteboard
          ref={wbRef}
          readOnly={!isTeacher}
          color={color}
          size={mode === "erase" ? 40 : size}
          mode={mode}
          onSegment={onSegment}
          onStrokeDone={onStrokeDone}
        />
      </div>

      {/* Panel de texto / código en vivo */}
      <Card>
        <CardContent className="p-4">
          <div className="mb-2 flex items-center gap-1.5 text-sm font-bold">
            <Code2 className="size-4 text-accent" /> Notas / código en vivo
          </div>
          <Textarea
            value={text}
            onChange={(e) => onTextChange(e.target.value)}
            readOnly={!isTeacher}
            placeholder={
              isTeacher
                ? "Escribe aquí notas o código… los estudiantes lo ven en vivo"
                : "Tu profesor escribirá aquí en vivo"
            }
            className="min-h-[160px] font-mono text-sm"
          />

          {/* Ejecutar el código del tablero */}
          <div className="mt-3 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Ejecutar como:</span>
              {(["python", "java"] as ProgLanguage[]).map((l) => (
                <button
                  key={l}
                  onClick={() => setRunLang(l)}
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
            </div>
            <CodeRunner language={runLang} code={text} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
