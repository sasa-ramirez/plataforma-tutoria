import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Terminal, CheckCircle2, XCircle, Keyboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/common/Spinner";
import { runCode, isRunnable, type RunResult } from "@/services/runner";
import type { ProgLanguage } from "@/types/database";

/** Botón "Ejecutar" + consola de salida. Solo para Python/Java. */
export function CodeRunner({
  language,
  code,
}: {
  language: ProgLanguage;
  code: string;
}) {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);
  const [stdin, setStdin] = useState("");
  const [showInput, setShowInput] = useState(false);

  if (!isRunnable(language)) return null;

  const run = async () => {
    setRunning(true);
    setResult(null);
    try {
      setResult(await runCode(language, code, stdin));
    } catch (e) {
      setResult({
        ok: false,
        stdout: "",
        stderr: e instanceof Error ? e.message : "Error al ejecutar",
      });
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-2">
      {/* Entrada (stdin): para programas con Scanner / input() */}
      <button
        type="button"
        onClick={() => setShowInput((v) => !v)}
        className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        <Keyboard className="size-3.5" />
        {showInput ? "Ocultar entrada" : "¿Tu programa pide datos? Agregar entrada"}
      </button>
      <AnimatePresence>
        {showInput && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <Textarea
              value={stdin}
              onChange={(e) => setStdin(e.target.value)}
              placeholder={"Lo que tu programa leería del teclado.\nUn dato por línea. Ej:\n21"}
              className="min-h-[70px] font-mono text-xs"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Cada línea es una respuesta a un <code>Scanner</code> /{" "}
              <code>input()</code>.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <Button
        type="button"
        variant="outline"
        onClick={run}
        disabled={running}
        className="w-full"
      >
        {running ? <Spinner className="size-4" /> : <Play className="size-4 fill-current" />}
        {running ? "Ejecutando…" : "Ejecutar código"}
      </Button>

      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="rounded-xl border bg-[#0e0d1a] p-3">
              <div className="mb-2 flex items-center gap-1.5 text-xs font-bold">
                <Terminal className="size-3.5 text-accent" />
                <span className="text-white/70">Salida</span>
                {result.ok ? (
                  <CheckCircle2 className="size-3.5 text-success" />
                ) : (
                  <XCircle className="size-3.5 text-destructive" />
                )}
              </div>
              <pre className="max-h-60 overflow-auto whitespace-pre-wrap break-words font-mono text-xs text-white/90">
                {result.stderr ? (
                  <span className="text-red-400">{result.stderr}</span>
                ) : (
                  result.stdout || "(sin salida)"
                )}
              </pre>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
