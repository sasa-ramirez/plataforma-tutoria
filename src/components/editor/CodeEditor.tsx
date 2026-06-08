import { useState, useCallback, useRef } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import { motion } from "framer-motion";
import {
  Maximize2,
  Minimize2,
  Plus,
  Minus,
  RotateCcw,
  Send,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { LANGUAGE_META } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { ProgLanguage } from "@/types/database";

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language: ProgLanguage;
  readOnly?: boolean;
  submitting?: boolean;
  onSubmit?: () => void;
  onReset?: () => void;
}

const MIN_FONT = 12;
const MAX_FONT = 22;

// Barra de símbolos para escribir código en el celular sin pelear con el teclado.
const SYMBOL_KEYS: { label: string; insert?: string; cmd?: string }[] = [
  { label: "Tab", cmd: "tab" },
  { label: "{", insert: "{" },
  { label: "}", insert: "}" },
  { label: "(", insert: "(" },
  { label: ")", insert: ")" },
  { label: "[", insert: "[" },
  { label: "]", insert: "]" },
  { label: ";", insert: ";" },
  { label: '"', insert: '"' },
  { label: "'", insert: "'" },
  { label: "=", insert: "=" },
  { label: "<", insert: "<" },
  { label: ">", insert: ">" },
  { label: "+", insert: "+" },
  { label: "-", insert: "-" },
  { label: "*", insert: "*" },
  { label: "/", insert: "/" },
  { label: ":", insert: ":" },
  { label: ".", insert: "." },
  { label: "_", insert: "_" },
  { label: "←", cmd: "cursorLeft" },
  { label: "→", cmd: "cursorRight" },
  { label: "⌫", cmd: "deleteLeft" },
];

export function CodeEditor({
  value,
  onChange,
  language,
  readOnly = false,
  submitting = false,
  onSubmit,
  onReset,
}: CodeEditorProps) {
  const [fullscreen, setFullscreen] = useState(false);
  const [fontSize, setFontSize] = useState(14);
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);

  const handleMount: OnMount = useCallback((editor, monaco) => {
    editorRef.current = editor;
    // Tema oscuro a tono con la marca
    monaco.editor.defineTheme("tutoria-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [],
      colors: {
        "editor.background": "#0e0d1a",
        "editor.lineHighlightBackground": "#1a1830",
        "editorLineNumber.foreground": "#4b4870",
        "editorCursor.foreground": "#a78bfa",
      },
    });
    monaco.editor.setTheme("tutoria-dark");
    // Apaga autocorrector / mayúsculas automáticas en móvil (dañan el código).
    const ta = editor.getDomNode()?.querySelector("textarea");
    if (ta) {
      ta.setAttribute("autocorrect", "off");
      ta.setAttribute("autocapitalize", "off");
      ta.setAttribute("autocomplete", "off");
      ta.setAttribute("spellcheck", "false");
    }
    editor.focus();
  }, []);

  // Inserta texto donde está el cursor (barra de símbolos móvil).
  const insertSymbol = useCallback((text: string) => {
    const ed = editorRef.current;
    if (!ed) return;
    ed.focus();
    const sel = ed.getSelection();
    if (sel) ed.executeEdits("kbd", [{ range: sel, text, forceMoveMarkers: true }]);
  }, []);

  // Ejecuta un comando del editor (Tab, mover cursor, borrar).
  const runCmd = useCallback((cmd: string) => {
    const ed = editorRef.current;
    if (!ed) return;
    ed.focus();
    ed.trigger("kbd", cmd, null);
  }, []);

  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-2xl border bg-[#0e0d1a]",
        fullscreen
          ? "fixed inset-0 z-50 rounded-none"
          : "relative h-[55vh] min-h-[320px] md:h-[60vh]",
      )}
    >
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 border-b border-white/10 bg-white/5 px-3 py-2">
        <div className="flex items-center gap-2 text-xs font-medium text-white/70">
          <span>{LANGUAGE_META[language].emoji}</span>
          <span>{LANGUAGE_META[language].label}</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 text-white/70 hover:bg-white/10 hover:text-white"
            onClick={() => setFontSize((f) => Math.max(MIN_FONT, f - 1))}
            aria-label="Reducir fuente"
          >
            <Minus className="size-4" />
          </Button>
          <span className="w-6 text-center text-xs text-white/60">
            {fontSize}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 text-white/70 hover:bg-white/10 hover:text-white"
            onClick={() => setFontSize((f) => Math.min(MAX_FONT, f + 1))}
            aria-label="Aumentar fuente"
          >
            <Plus className="size-4" />
          </Button>
          {onReset && !readOnly && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 text-white/70 hover:bg-white/10 hover:text-white"
              onClick={onReset}
              aria-label="Reiniciar código"
            >
              <RotateCcw className="size-4" />
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 text-white/70 hover:bg-white/10 hover:text-white"
            onClick={() => setFullscreen((v) => !v)}
            aria-label={fullscreen ? "Salir de pantalla completa" : "Expandir"}
          >
            {fullscreen ? (
              <Minimize2 className="size-4" />
            ) : (
              <Maximize2 className="size-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Barra de símbolos (ayuda a programar en el celular) */}
      {!readOnly && (
        <div className="flex gap-1 overflow-x-auto border-b border-white/10 bg-white/5 px-2 py-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {SYMBOL_KEYS.map((k) => (
            <button
              key={k.label}
              type="button"
              // Evita que el editor pierda el cursor al tocar el botón.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => (k.cmd ? runCmd(k.cmd) : insertSymbol(k.insert ?? ""))}
              className="grid h-9 min-w-9 shrink-0 place-items-center rounded-lg bg-white/10 px-2 font-mono text-sm font-semibold text-white/90 active:bg-primary/40"
            >
              {k.label}
            </button>
          ))}
        </div>
      )}

      {/* Editor */}
      <div className="relative flex-1">
        <Editor
          height="100%"
          language={LANGUAGE_META[language].monaco}
          value={value}
          onChange={(v) => onChange(v ?? "")}
          onMount={handleMount}
          loading={
            <div className="flex h-full items-center justify-center">
              <Loader2 className="size-6 animate-spin text-primary" />
            </div>
          }
          options={{
            fontSize,
            fontFamily: "JetBrains Mono, monospace",
            fontLigatures: true,
            minimap: { enabled: false },
            lineNumbers: "on",
            readOnly,
            scrollBeyondLastLine: false,
            smoothScrolling: true,
            cursorBlinking: "smooth",
            padding: { top: 14, bottom: 80 },
            tabSize: 2,
            wordWrap: "on",
            automaticLayout: true,
            quickSuggestions: true,
            suggestOnTriggerCharacters: true,
            // Cómodo en táctil
            scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10 },
          }}
        />

        {/* FAB de enviar (flotante, grande para el pulgar) */}
        {onSubmit && !readOnly && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="absolute bottom-4 right-4 z-10"
          >
            <Button
              type="button"
              variant="brand"
              size="lg"
              className="rounded-full shadow-xl shadow-primary/40"
              onClick={onSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <Loader2 className="size-5 animate-spin" />
              ) : (
                <Send className="size-5" />
              )}
              {submitting ? "Revisando…" : "Enviar"}
            </Button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
