import type { ProgLanguage } from "@/types/database";
import { runPseint } from "@/lib/pseint";

// Ejecución de código ROBUSTA: dos motores gratis (sin API key, con CORS).
// Wandbox es el primario; si está caído/saturado, cae automáticamente a
// Judge0 CE. Antes dependíamos de uno solo (Piston cerró, Wandbox se satura),
// así que ahora hay respaldo automático.
const WANDBOX = "https://wandbox.org/api/compile.json";
const JUDGE0 = "https://ce.judge0.com/submissions?base64_encoded=false&wait=true";

const WANDBOX_COMPILER: Partial<Record<ProgLanguage, string>> = {
  python: "cpython-3.13.8",
  java: "openjdk-jdk-21+35",
};
const JUDGE0_LANG: Partial<Record<ProgLanguage, number>> = {
  python: 71, // Python 3
  java: 62, // OpenJDK
};

export function isRunnable(language: ProgLanguage): boolean {
  return language === "pseint" || language in WANDBOX_COMPILER;
}

/**
 * Adivina si un fragmento es Java o Python por señales típicas.
 * Útil en el tablero, donde el texto no tiene lenguaje asociado.
 * Por defecto cae en Python (más común en principiantes).
 */
export function detectLanguage(code: string): "python" | "java" | "pseint" {
  const c = code ?? "";
  if (/^\s*(algoritmo|proceso)\s+\w+/im.test(c)) return "pseint";
  const javaHints = [
    /\bpublic\s+class\b/,
    /\bSystem\.out\.print/,
    /\b(public|private|protected|static)\s+(static\s+)?(void|int|String|double|boolean)\b/,
    /\bvoid\s+main\s*\(/,
    /;\s*$/m, // líneas que terminan en ;
  ];
  const pyHints = [
    /^\s*def\s+\w+\s*\(/m,
    /\bprint\s*\(/,
    /^\s*import\s+\w+\s*$/m,
    /:\s*$/m, // bloques que terminan en :
  ];
  const javaScore = javaHints.reduce((n, re) => n + (re.test(c) ? 1 : 0), 0);
  const pyScore = pyHints.reduce((n, re) => n + (re.test(c) ? 1 : 0), 0);
  return javaScore > pyScore ? "java" : "python";
}

export interface RunResult {
  ok: boolean;
  stdout: string;
  stderr: string;
}

// available:false → el motor está caído/saturado (probar el siguiente).
// available:true  → el motor respondió (aunque el código tenga errores).
type Outcome = { available: true; result: RunResult } | { available: false };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
// Error de infraestructura del motor (no del código del estudiante).
const TRANSIENT = /OCI runtime|Resource temporarily unavailable|\bclone:/i;

/** Wandbox compila en prog.java → quitamos `public` de la clase. */
function prepareJavaWandbox(code: string): string {
  return code.replace(/\bpublic\s+class\b/g, "class");
}
/** Judge0 ejecuta la clase `Main` → renombramos la clase pública a Main. */
function prepareJavaJudge0(code: string): string {
  return code.replace(/public\s+class\s+\w+/, "public class Main");
}

// ---------- Motor 1: Wandbox ----------
async function runWandbox(
  language: ProgLanguage,
  code: string,
  stdin: string,
): Promise<Outcome> {
  const compiler = WANDBOX_COMPILER[language]!;
  const source = language === "java" ? prepareJavaWandbox(code) : code;
  const body = JSON.stringify({ compiler, code: source, stdin });

  for (let attempt = 1; attempt <= 2; attempt++) {
    let res: Response;
    try {
      res = await fetch(WANDBOX, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
    } catch {
      return { available: false };
    }
    if (!res.ok) return { available: false };

    const data = (await res.json()) as {
      status?: string;
      compiler_error?: string;
      program_output?: string;
      program_error?: string;
    };
    const compileErr = (data.compiler_error ?? "").trim();
    if (TRANSIENT.test(compileErr)) {
      if (attempt < 2) {
        await sleep(1200);
        continue;
      }
      return { available: false };
    }
    const runErr = (data.program_error ?? "").trim();
    const stderr = [compileErr, runErr].filter(Boolean).join("\n").trim();
    const stdout = (data.program_output ?? "").trim();
    return {
      available: true,
      result: { ok: data.status === "0" && !stderr, stdout, stderr },
    };
  }
  return { available: false };
}

// ---------- Motor 2: Judge0 CE (respaldo) ----------
async function runJudge0(
  language: ProgLanguage,
  code: string,
  stdin: string,
): Promise<Outcome> {
  const langId = JUDGE0_LANG[language]!;
  const source = language === "java" ? prepareJavaJudge0(code) : code;

  let res: Response;
  try {
    res = await fetch(JUDGE0, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        language_id: langId,
        source_code: source,
        stdin,
      }),
    });
  } catch {
    return { available: false };
  }
  if (!res.ok) return { available: false };

  const data = (await res.json()) as {
    stdout?: string | null;
    stderr?: string | null;
    compile_output?: string | null;
    status?: { id?: number };
  };
  // id 13 = Internal Error (motor con problemas) → probar otro.
  if (!data.status || data.status.id === 13) return { available: false };

  const compileErr = (data.compile_output ?? "").trim();
  const runErr = (data.stderr ?? "").trim();
  const stderr = [compileErr, runErr].filter(Boolean).join("\n").trim();
  const stdout = (data.stdout ?? "").trim();
  return {
    available: true,
    result: { ok: data.status.id === 3 && !stderr, stdout, stderr },
  };
}

// ---------- Modo interactivo (pide los datos uno a uno) ----------
// Los motores externos no se pueden pausar, así que se re-ejecuta el programa
// con las respuestas acumuladas; cuando pide un dato que aún no existe, el
// motor responde "fin de la entrada" y ahí se muestra la casilla de escritura.

// Hace que input() repita en la salida lo que se escribió (como en una terminal)
// y fija la semilla de random para que las re-ejecuciones den los mismos números.
// Va en UNA sola línea al inicio (por eso los números de línea se corrigen).
const PY_ECHO =
  'import builtins as _b;_o=_b.input;_b.input=lambda p="":(lambda v:(print(v),v)[1])(_o(p))';

function patchPython(code: string, seed: number) {
  // «from __future__» debe ser lo primero del archivo: ahí no se toca el código.
  if (/^\s*from\s+__future__\b/m.test(code)) return { code, shifted: false };
  return {
    code: `${PY_ECHO};import random as _r;_r.seed(${seed})\n${code}`,
    shifted: true,
  };
}

// Entrada estándar que entrega una línea por vez y la repite en la salida.
// (10 = salto de línea; se usa el número para no depender de escapes.)
const JAVA_ECHO_CLASS = `
class __EchoIn extends java.io.InputStream {
  static final __EchoIn IN = new __EchoIn();
  private byte[] buf = new byte[0];
  private int pos = 0;
  public int available() { return buf.length - pos; }
  public int read() throws java.io.IOException {
    byte[] one = new byte[1];
    int n = read(one, 0, 1);
    return n < 0 ? -1 : (one[0] & 0xff);
  }
  public int read(byte[] b, int off, int len) throws java.io.IOException {
    if (pos >= buf.length) {
      java.io.ByteArrayOutputStream line = new java.io.ByteArrayOutputStream();
      int c;
      while ((c = System.in.read()) != -1) { line.write(c); if (c == 10) break; }
      if (line.size() == 0) return -1;
      buf = line.toByteArray();
      pos = 0;
      System.out.print(new String(buf));
    }
    int n = Math.min(len, buf.length - pos);
    System.arraycopy(buf, pos, b, off, n);
    pos += n;
    return n;
  }
}
`;

function patchJava(code: string): string {
  if (!/\bSystem\.in\b/.test(code)) return code;
  return code.replace(/\bSystem\.in\b/g, "__EchoIn.IN") + "\n" + JAVA_ECHO_CLASS;
}

export interface InteractiveResult extends RunResult {
  /** El programa se detuvo esperando un dato (falta una respuesta). */
  waiting: boolean;
}

/** Ejecuta con las respuestas dadas; si el programa pide una más, devuelve waiting. */
export async function runCodeInteractive(
  language: ProgLanguage,
  code: string,
  answers: string[],
  seed: number,
): Promise<InteractiveResult> {
  if (language === "pseint") {
    const r = runPseint(code, answers, { interactive: true, seed });
    return { ok: r.ok, stdout: r.stdout, stderr: r.error ?? "", waiting: r.waiting };
  }
  if (!isRunnable(language)) {
    return { ok: false, stdout: "", stderr: "Este lenguaje no se puede ejecutar.", waiting: false };
  }

  const stdin = answers.length ? answers.join("\n") + "\n" : "";
  let source = code;
  let shifted = false;
  if (language === "python") {
    const p = patchPython(code, seed);
    source = p.code;
    shifted = p.shifted;
  } else if (language === "java") {
    source = patchJava(code);
  }

  const r = await runCode(language, source, stdin);
  const endOfInput =
    language === "python"
      ? /EOFError/.test(r.stderr)
      : /NoSuchElementException/.test(r.stderr);
  if (endOfInput) return { ok: true, stdout: r.stdout, stderr: "", waiting: true };

  // La línea extra del parche corre los números de línea de los errores de Python.
  const stderr = shifted
    ? r.stderr.replace(/(line )(\d+)/g, (_m, a: string, n: string) => a + Math.max(1, Number(n) - 1))
    : r.stderr;
  return { ...r, stderr, waiting: false };
}

export async function runCode(
  language: ProgLanguage,
  code: string,
  stdin = "",
): Promise<RunResult> {
  if (!isRunnable(language)) {
    return { ok: false, stdout: "", stderr: "Este lenguaje no se puede ejecutar." };
  }

  // PSeInt se interpreta aquí mismo, en el navegador (no hay servidor externo).
  if (language === "pseint") {
    const lines = stdin.split(/\r?\n/);
    while (lines.length && lines[lines.length - 1] === "") lines.pop();
    const r = runPseint(code, lines);
    return { ok: r.ok, stdout: r.stdout, stderr: r.error ?? "" };
  }

  // Primario: Wandbox. Si está caído/saturado → Judge0.
  const primary = await runWandbox(language, code, stdin);
  if (primary.available) return primary.result;

  const backup = await runJudge0(language, code, stdin);
  if (backup.available) return backup.result;

  return {
    ok: false,
    stdout: "",
    stderr:
      "Los motores de ejecución están saturados en este momento (no es tu código). Espera unos segundos y vuelve a intentar. La IA igual puede revisar tu código.",
  };
}
