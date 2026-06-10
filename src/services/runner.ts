import type { ProgLanguage } from "@/types/database";

// Motor de ejecución de código: Wandbox (gratis, sin API key, con CORS).
// Reemplazó a Piston (emkc.org), que pasó a ser "whitelist only" en 2026 y
// devolvía 401 a todos.
const WANDBOX = "https://wandbox.org/api/compile.json";

// Solo lenguajes reales son ejecutables. PSeInt no tiene runtime.
const COMPILER: Partial<Record<ProgLanguage, string>> = {
  python: "cpython-3.13.8",
  java: "openjdk-jdk-21+35",
};

export function isRunnable(language: ProgLanguage): boolean {
  return language in COMPILER;
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

/**
 * Wandbox guarda el código en `prog.java`, así que una clase `public class X`
 * no compila (Java exige X.java). Para principiantes con una sola clase,
 * quitar el modificador `public` de la clase es seguro y la deja ejecutable.
 */
function prepareJava(code: string): string {
  return code.replace(/\bpublic\s+class\b/g, "class");
}

interface WandboxData {
  status?: string;
  compiler_error?: string;
  program_output?: string;
  program_error?: string;
}

// Error de infraestructura de Wandbox (no del código del estudiante): el
// servidor no pudo crear el contenedor. Suele ser pasajero → reintentamos.
const TRANSIENT = /OCI runtime|Resource temporarily unavailable|\bclone:/i;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function runCode(
  language: ProgLanguage,
  code: string,
  stdin = "",
): Promise<RunResult> {
  const compiler = COMPILER[language];
  if (!compiler) {
    return { ok: false, stdout: "", stderr: "Este lenguaje no se puede ejecutar." };
  }

  const source = language === "java" ? prepareJava(code) : code;
  const body = JSON.stringify({ compiler, code: source, stdin });

  let lastTransient = false;
  for (let attempt = 1; attempt <= 3; attempt++) {
    let res: Response;
    try {
      res = await fetch(WANDBOX, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
    } catch {
      if (attempt < 3) {
        await sleep(1200);
        continue;
      }
      return {
        ok: false,
        stdout: "",
        stderr:
          "No se pudo conectar con el motor de ejecución. Revisa tu conexión e inténtalo de nuevo.",
      };
    }

    if (!res.ok) {
      if (attempt < 3) {
        await sleep(1200);
        continue;
      }
      return { ok: false, stdout: "", stderr: `Error del motor (${res.status}).` };
    }

    const data = (await res.json()) as WandboxData;
    const compileErr = (data.compiler_error ?? "").trim();

    // Si el motor está saturado, espera y reintenta.
    if (TRANSIENT.test(compileErr)) {
      lastTransient = true;
      if (attempt < 3) {
        await sleep(1500);
        continue;
      }
      break;
    }

    const runErr = (data.program_error ?? "").trim();
    const stderr = [compileErr, runErr].filter(Boolean).join("\n").trim();
    const stdout = (data.program_output ?? "").trim();
    return { ok: data.status === "0" && !stderr, stdout, stderr };
  }

  // Agotó los reintentos por saturación del motor.
  return {
    ok: false,
    stdout: "",
    stderr: lastTransient
      ? "El motor de ejecución está saturado en este momento (no es tu código). Espera unos segundos y vuelve a intentar. La IA igual puede revisar tu código."
      : "No se pudo ejecutar. Inténtalo de nuevo en unos segundos.",
  };
}
