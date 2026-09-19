import { useEffect, useRef, useState, type FormEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Terminal, CheckCircle2, XCircle, Keyboard, CornerDownLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/common/Spinner";
import { runCode, isRunnable, type RunResult } from "@/services/runner";
import { runPseint } from "@/lib/pseint";
import type { ProgLanguage } from "@/types/database";

/** Botón "Ejecutar" + consola de salida. Python/Java (servidor) y PSeInt (local). */
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

  // PSeInt: consola interactiva. Cada respuesta se agrega a la lista y el
  // programa se vuelve a correr desde el inicio con la misma semilla al azar.
  const isPse = language === "pseint";
  const [answers, setAnswers] = useState<string[]>([]);
  const [seed, setSeed] = useState(0);
  const [waiting, setWaiting] = useState(false);
  const [answer, setAnswer] = useState("");
  const answerRef = useRef<HTMLInputElement>(null);

  // Si editan el código a mitad de una ejecución, esa ejecución ya no vale.
  useEffect(() => {
    setWaiting(false);
  }, [code]);
  useEffect(() => {
    if (waiting) answerRef.current?.focus();
  }, [waiting, answers.length]);

  if (!isRunnable(language)) return null;

  const runPse = (nextAnswers: string[], nextSeed: number) => {
    const r = runPseint(code, nextAnswers, { interactive: true, seed: nextSeed });
    setResult({ ok: r.ok, stdout: r.stdout, stderr: r.error ?? "" });
    setWaiting(r.waiting);
    setAnswers(nextAnswers);
    setSeed(nextSeed);
  };

  const submitAnswer = (e: FormEvent) => {
    e.preventDefault();
    runPse([...answers, answer], seed);
    setAnswer("");
  };

  const run = async () => {
    if (isPse) {
      setAnswer("");
      runPse([], Math.floor(Math.random() * 2 ** 31));
      return;
    }
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
      {!isPse && (
        <button
          type="button"
          onClick={() => setShowInput((v) => !v)}
          className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <Keyboard className="size-3.5" />
          {showInput ? "Ocultar entrada" : "¿Tu programa pide datos? Agregar entrada"}
        </button>
      )}
      <AnimatePresence>
        {showInput && !isPse && (
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
                  <>
                    {isPse && result.stdout ? `${result.stdout}\n\n` : ""}
                    <span className="text-red-400">{result.stderr}</span>
                  </>
                ) : (
                  result.stdout || (waiting ? "" : "(sin salida)")
                )}
              </pre>
              {isPse && waiting && (
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
