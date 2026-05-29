import { useState, useCallback } from "react";
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

  const handleMount: OnMount = useCallback((editor, monaco) => {
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
    editor.focus();
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
