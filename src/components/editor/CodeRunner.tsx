import { useEffect, useRef, useState, type FormEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Terminal, CheckCircle2, XCircle, CornerDownLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/common/Spinner";
import { runCodeInteractive, isRunnable, type InteractiveResult } from "@/services/runner";
import type { ProgLanguage } from "@/types/database";

/**
 * Botón "Ejecutar" + consola interactiva. Cuando el programa pide un dato
 * (Leer / input() / Scanner) se detiene, aparece una casilla para escribirlo y
 * se vuelve a ejecutar con las respuestas acumuladas. PSeInt corre en el
 * navegador; Python y Java, en un servidor externo.
 */
export function CodeRunner({
  language,
  code,
}: {
  language: ProgLanguage;
  code: string;
}) {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<InteractiveResult | null>(null);
  const [answers, setAnswers] = useState<string[]>([]);
  const [seed, setSeed] = useState(0);
  const [answer, setAnswer] = useState("");
  const answerRef = useRef<HTMLInputElement>(null);
  // Descarta respuestas de una ejecución vieja si empezaron otra o cambiaron el código.
  const runId = useRef(0);

  const waiting = !!result?.waiting && !running;

  // Si editan el código a mitad de una ejecución, esa ejecución ya no vale.
  useEffect(() => {
    runId.current++;
    setRunning(false);
    setResult((r) => (r?.waiting ? { ...r, waiting: false } : r));
  }, [code, language]);

  useEffect(() => {
    if (waiting) answerRef.current?.focus();
  }, [waiting, answers.length]);

  if (!isRunnable(language)) return null;

  const execute = async (nextAnswers: string[], nextSeed: number) => {
    const id = ++runId.current;
    setRunning(true);
    try {
      const r = await runCodeInteractive(language, code, nextAnswers, nextSeed);
      if (id !== runId.current) return;
      setResult(r);
      setAnswers(nextAnswers);
      setSeed(nextSeed);
    } catch (e) {
      if (id !== runId.current) return;
      setResult({
        ok: false,
        stdout: "",
        stderr: e instanceof Error ? e.message : "Error al ejecutar",
        waiting: false,
      });
    } finally {
      if (id === runId.current) setRunning(false);
    }
  };

  const run = () => {
    setAnswer("");
    return execute([], Math.floor(Math.random() * 2 ** 31));
  };

  const submitAnswer = (e: FormEvent) => {
    e.preventDefault();
    const next = [...answers, answer];
    setAnswer("");
    return execute(next, seed);
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
                {result.waiting ? (
                  <span className="font-medium text-amber-300/90">esperando un dato…</span>
                ) : result.ok ? (
                  <CheckCircle2 className="size-3.5 text-success" />
                ) : (
                  <XCircle className="size-3.5 text-destructive" />
                )}
              </div>
              <pre className="max-h-60 overflow-auto whitespace-pre-wrap break-words font-mono text-xs text-white/90">
                {result.stderr ? (
                  <>
                    {result.stdout ? `${result.stdout}\n\n` : ""}
                    <span className="text-red-400">{result.stderr}</span>
                  </>
                ) : (
                  result.stdout || (result.waiting ? "" : "(sin salida)")
                )}
              </pre>
              {waiting && (
                <form onSubmit={submitAnswer} className="mt-2 flex items-center gap-2">
                  <Input
                    ref={answerRef}
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    placeholder="El programa espera un dato…"
                    autoComplete="off"
                    className="h-9 flex-1 border-white/20 bg-white/5 font-mono text-xs text-white placeholder:text-white/40"
                  />
                  <Button type="submit" size="sm" variant="brand" className="h-9">
                    <CornerDownLeft className="size-3.5" /> Enviar dato
                  </Button>
                </form>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
