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

export async function runCode(
  language: ProgLanguage,
  code: string,
): Promise<RunResult> {
  const compiler = COMPILER[language];
  if (!compiler) {
    return { ok: false, stdout: "", stderr: "Este lenguaje no se puede ejecutar." };
  }

  const source = language === "java" ? prepareJava(code) : code;

  let res: Response;
  try {
    res = await fetch(WANDBOX, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ compiler, code: source }),
    });
  } catch {
    return {
      ok: false,
      stdout: "",
      stderr: "No se pudo conectar con el motor de ejecución. Revisa tu conexión.",
    };
  }

  if (!res.ok) {
    return { ok: false, stdout: "", stderr: `Error del motor (${res.status}).` };
  }

  const data = (await res.json()) as {
    status?: string;
    compiler_error?: string;
    program_output?: string;
    program_error?: string;
  };

  const compileErr = (data.compiler_error ?? "").trim();
  const runErr = (data.program_error ?? "").trim();
  const stderr = [compileErr, runErr].filter(Boolean).join("\n").trim();
  const stdout = (data.program_output ?? "").trim();

  return { ok: data.status === "0" && !stderr, stdout, stderr };
}
