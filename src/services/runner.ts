import type { ProgLanguage } from "@/types/database";

// Piston: motor de ejecución de código gratis y abierto (con CORS).
const PISTON = "https://emkc.org/api/v2/piston";

// Solo lenguajes reales son ejecutables. PSeInt no tiene runtime.
const RUNNABLE: Partial<Record<ProgLanguage, { lang: string; file: string }>> = {
  python: { lang: "python", file: "main.py" },
  java: { lang: "java", file: "Main.java" },
};

export function isRunnable(language: ProgLanguage): boolean {
  return language in RUNNABLE;
}

let runtimesCache: { language: string; version: string; aliases?: string[] }[] | null =
  null;

async function getVersion(lang: string): Promise<string> {
  if (!runtimesCache) {
    runtimesCache = await fetch(`${PISTON}/runtimes`).then((r) => r.json());
  }
  const rt = runtimesCache!.find(
    (r) => r.language === lang || r.aliases?.includes(lang),
  );
  return rt?.version ?? "*";
}

export interface RunResult {
  ok: boolean;
  stdout: string;
  stderr: string;
}

export async function runCode(
  language: ProgLanguage,
  code: string,
): Promise<RunResult> {
  const meta = RUNNABLE[language];
  if (!meta) {
    return { ok: false, stdout: "", stderr: "Este lenguaje no se puede ejecutar." };
  }
  const version = await getVersion(meta.lang);
  const res = await fetch(`${PISTON}/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      language: meta.lang,
      version,
      files: [{ name: meta.file, content: code }],
    }),
  });
  if (!res.ok) {
    return { ok: false, stdout: "", stderr: `Error del motor (${res.status}).` };
  }
  // deno/ts: respuesta de Piston
  const data = (await res.json()) as {
    run?: { stdout?: string; stderr?: string; output?: string };
    compile?: { stderr?: string };
    message?: string;
  };
  const compileErr = data.compile?.stderr ?? "";
  const stderr = (compileErr || data.run?.stderr || "").trim();
  const stdout = (data.run?.stdout ?? "").trim();
  return { ok: !stderr, stdout, stderr: stderr || data.message || "" };
}
