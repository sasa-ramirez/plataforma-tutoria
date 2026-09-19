import { describe, it, expect, vi, afterEach } from "vitest";
import { isRunnable, detectLanguage, runCodeInteractive } from "./runner";

function mockWandbox(reply: { status?: string; program_output?: string; program_error?: string }) {
  const fn = vi.fn(async () => ({
    ok: true,
    json: async () => ({ status: "0", compiler_error: "", program_output: "", program_error: "", ...reply }),
  }));
  vi.stubGlobal("fetch", fn);
  return fn;
}

describe("runCodeInteractive", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("Python: manda las respuestas como stdin y repite lo escrito con input()", async () => {
    const fetchMock = mockWandbox({ program_output: "Numero: 4\nSuma: 4\n" });
    const r = await runCodeInteractive("python", 'n = int(input("Numero: "))\nprint("Suma:", n)', ["4"], 7);
    const body = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, { body: string }])[1].body);
    expect(body.stdin).toBe("4\n");
    expect(body.code).toContain("_b.input=");
    expect(body.code).toContain("_r.seed(7)");
    expect(r.waiting).toBe(false);
    expect(r.stdout).toBe("Numero: 4\nSuma: 4");
  });

  it("Python: EOFError significa que falta un dato (no es un error)", async () => {
    mockWandbox({
      status: "1",
      program_output: "Numero: ",
      program_error: "Traceback...\nEOFError: EOF when reading a line\n",
    });
    const r = await runCodeInteractive("python", 'n = input("Numero: ")', [], 1);
    expect(r.waiting).toBe(true);
    expect(r.ok).toBe(true);
    expect(r.stderr).toBe("");
    expect(r.stdout).toBe("Numero:");
  });

  it("Python: corrige el número de línea de los errores por la línea extra del parche", async () => {
    mockWandbox({
      status: "1",
      program_error: 'File "/home/wandbox/prog.py", line 3, in <module>\nZeroDivisionError: division by zero\n',
    });
    const r = await runCodeInteractive("python", "a = 1\nprint(1/0)", [], 1);
    expect(r.waiting).toBe(false);
    expect(r.stderr).toContain("line 2");
  });

  it("Java: cambia System.in por la entrada que repite lo escrito", async () => {
    const fetchMock = mockWandbox({ program_output: "ok\n" });
    await runCodeInteractive(
      "java",
      "import java.util.*;\npublic class Main { public static void main(String[] a){ Scanner s = new Scanner(System.in); } }",
      ["5"],
      1,
    );
    const body = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, { body: string }])[1].body);
    expect(body.code).toContain("new Scanner(__EchoIn.IN)");
    expect(body.code).toContain("class __EchoIn extends java.io.InputStream");
  });

  it("Java: NoSuchElementException significa que falta un dato", async () => {
    mockWandbox({
      status: "1",
      program_output: "Numero: ",
      program_error: "Exception in thread main java.util.NoSuchElementException\n",
    });
    const r = await runCodeInteractive("java", "class Main { void f(){ new java.util.Scanner(System.in); } }", [], 1);
    expect(r.waiting).toBe(true);
  });

  it("PSeInt: usa el intérprete local", async () => {
    const r = await runCodeInteractive("pseint", `Algoritmo A\n Leer x\n Escribir x\nFinAlgoritmo`, [], 1);
    expect(r.waiting).toBe(true);
    const r2 = await runCodeInteractive("pseint", `Algoritmo A\n Leer x\n Escribir x\nFinAlgoritmo`, ["hola"], 1);
    expect(r2.stdout).toBe("hola\nhola");
  });
});

describe("isRunnable", () => {
  it("python, java y pseint se pueden ejecutar", () => {
    expect(isRunnable("python")).toBe(true);
    expect(isRunnable("java")).toBe(true);
    expect(isRunnable("pseint")).toBe(true);
  });
});

describe("detectLanguage", () => {
  it("detecta Python por 'def' y 'print'", () => {
    const code = `def saludar(nombre):\n    print("hola", nombre)\n`;
    expect(detectLanguage(code)).toBe("python");
  });

  it("detecta Java por 'public class' y 'System.out.print'", () => {
    const code = `public class Main {\n  public static void main(String[] args) {\n    System.out.println("hola");\n  }\n}`;
    expect(detectLanguage(code)).toBe("java");
  });

  it("detecta PSeInt por «Algoritmo Nombre»", () => {
    expect(detectLanguage(`Algoritmo Suma\n  Escribir "hola"\nFinAlgoritmo`)).toBe("pseint");
    expect(detectLanguage(`Proceso Prueba\n  x <- 1\nFinProceso`)).toBe("pseint");
  });

  it("por defecto asume Python si no hay señales claras", () => {
    expect(detectLanguage("")).toBe("python");
    expect(detectLanguage("x = 1")).toBe("python");
  });

  it("no truena con código nulo/indefinido", () => {
    // @ts-expect-error -- se prueba a propósito el caso sin código
    expect(detectLanguage(null)).toBe("python");
  });
});
