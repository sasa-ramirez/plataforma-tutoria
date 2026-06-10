import type { ProgLanguage } from "@/types/database";

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
  return language in WANDBOX_COMPILER;
}

/**
 * Adivina si un fragmento es Java o Python por señales típicas.
 * Útil en el tablero, donde el texto no tiene lenguaje asociado.
 * Por defecto cae en Python (más común en principiantes).
 */
export function detectLanguage(code: string): "python" | "java" {
  const c = code ?? "";
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

export async function runCode(
  language: ProgLanguage,
  code: string,
  stdin = "",
): Promise<RunResult> {
  if (!isRunnable(language)) {
    return { ok: false, stdout: "", stderr: "Este lenguaje no se puede ejecutar." };
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
