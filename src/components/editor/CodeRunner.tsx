import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Terminal, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
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

  if (!isRunnable(language)) return null;

  const run = async () => {
    setRunning(true);
    setResult(null);
    try {
      setResult(await runCode(language, code));
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
