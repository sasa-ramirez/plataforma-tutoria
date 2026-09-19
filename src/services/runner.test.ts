import { describe, it, expect } from "vitest";
import { isRunnable, detectLanguage } from "./runner";

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
