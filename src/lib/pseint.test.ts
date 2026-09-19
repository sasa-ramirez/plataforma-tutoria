import { describe, it, expect } from "vitest";
import { runPseint } from "./pseint";

const run = (code: string, inputs: string[] = []) => runPseint(code, inputs);

describe("PSeInt: básicos", () => {
  it("Escribir y concatenación sin espacios", () => {
    const r = run(`Algoritmo Hola\n  Escribir "Hola", " ", "mundo"\nFinAlgoritmo`);
    expect(r.ok).toBe(true);
    expect(r.stdout).toBe("Hola mundo");
  });

  it("Leer, aritmética y decimales", () => {
    const r = run(
      `Algoritmo Suma
        Definir a, b Como Real
        Leer a, b
        Escribir a + b
        Escribir a / b
      FinAlgoritmo`,
      ["7", "2"],
    );
    expect(r.stdout).toBe("9\n3.5");
  });

  it("MOD, potencia y precedencia", () => {
    const r = run(`Algoritmo X\n Escribir 10 MOD 3, " ", 2^3, " ", 2+3*4, " ", -2^2\nFinAlgoritmo`);
    expect(r.stdout).toBe("1 8 14 -4");
  });

  it("acepta = como asignación y ; entre instrucciones", () => {
    const r = run(`Proceso P\n x = 5; y <- x * 2\n Escribir y\nFinProceso`);
    expect(r.stdout).toBe("10");
  });

  it("Escribir Sin Saltar", () => {
    const r = run(`Algoritmo S\n Escribir "a" Sin Saltar\n Escribir "b"\nFinAlgoritmo`);
    expect(r.stdout).toBe("ab");
  });

  it("ignora comentarios", () => {
    const r = run(`Algoritmo C\n // hola\n Escribir "x" // otro\n /* bloque\n varias */\nFinAlgoritmo`);
    expect(r.stdout).toBe("x");
  });
});

describe("PSeInt: control de flujo", () => {
  it("Si / SiNo con Y y O", () => {
    const code = `Algoritmo Edad
      Definir e Como Entero
      Leer e
      Si e >= 18 Y e < 65 Entonces
        Escribir "adulto"
      SiNo
        Si e < 18 Entonces
          Escribir "menor"
        SiNo
          Escribir "mayor"
        FinSi
      FinSi
    FinAlgoritmo`;
    expect(run(code, ["30"]).stdout).toBe("adulto");
    expect(run(code, ["10"]).stdout).toBe("menor");
    expect(run(code, ["70"]).stdout).toBe("mayor");
  });

  it("Mientras, Repetir y Para (con paso)", () => {
    const r = run(`Algoritmo L
      i <- 1
      Mientras i <= 3 Hacer
        Escribir i Sin Saltar
        i <- i + 1
      FinMientras
      Escribir ""
      Repetir
        i <- i - 1
        Escribir i Sin Saltar
      Hasta Que i = 1
      Escribir ""
      Para k <- 10 Hasta 1 Con Paso -3 Hacer
        Escribir k Sin Saltar
        Escribir " " Sin Saltar
      FinPara
    FinAlgoritmo`);
    expect(r.ok).toBe(true);
    expect(r.stdout).toBe("123\n321\n10 7 4 1 ");
  });

  it("Segun con varios valores y De Otro Modo", () => {
    const code = `Algoritmo Dia
      Leer d
      Segun d Hacer
        1, 7:
          Escribir "finde"
        2:
          Escribir "lunes"
        De Otro Modo:
          Escribir "otro"
      FinSegun
    FinAlgoritmo`;
    expect(run(code, ["1"]).stdout).toBe("finde");
    expect(run(code, ["2"]).stdout).toBe("lunes");
    expect(run(code, ["5"]).stdout).toBe("otro");
  });
});

describe("PSeInt: arreglos y funciones", () => {
  it("Dimension, matriz y rango 1..n", () => {
    const r = run(`Algoritmo A
      Dimension v[3], m[2,2]
      Para i <- 1 Hasta 3 Hacer
        v[i] <- i * i
      FinPara
      m[2,1] <- 9
      Escribir v[1] + v[2] + v[3], " ", m[2,1]
    FinAlgoritmo`);
    expect(r.stdout).toBe("14 9");
  });

  it("avisa si el subíndice se sale del arreglo", () => {
    const r = run(`Algoritmo A\n Dimension v[3]\n v[4] <- 1\nFinAlgoritmo`);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/línea 3/);
    expect(r.error).toMatch(/fuera del arreglo/);
  });

  it("Funcion con retorno y recursión", () => {
    const r = run(`Funcion r <- fact(n)
        Si n <= 1 Entonces
          r <- 1
        SiNo
          r <- n * fact(n - 1)
        FinSi
      FinFuncion
      Algoritmo F
        Escribir fact(5)
      FinAlgoritmo`);
    expect(r.stdout).toBe("120");
  });

  it("SubProceso con parámetro por referencia", () => {
    const r = run(`SubProceso duplicar(x Por Referencia)
        x <- x * 2
      FinSubProceso
      Algoritmo R
        n <- 4
        duplicar(n)
        Escribir n
      FinAlgoritmo`);
    expect(r.stdout).toBe("8");
  });

  it("funciones predefinidas", () => {
    const r = run(`Algoritmo B\n Escribir Raiz(16), " ", Abs(-3), " ", Trunc(2.9), " ", Longitud("hola"), " ", Mayusculas("ab")\nFinAlgoritmo`);
    expect(r.stdout).toBe("4 3 2 4 AB");
  });
});

describe("PSeInt: errores y límites", () => {
  it("variable sin valor", () => {
    const r = run(`Algoritmo E\n Escribir x\nFinAlgoritmo`);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/no tiene valor/);
  });

  it("división por cero", () => {
    const r = run(`Algoritmo E\n Escribir 1/0\nFinAlgoritmo`);
    expect(r.error).toMatch(/División por cero/);
  });

  it("Leer sin entradas explica cómo agregarlas y conserva la salida previa", () => {
    const r = run(`Algoritmo E\n Escribir "antes"\n Leer x\nFinAlgoritmo`);
    expect(r.ok).toBe(false);
    expect(r.stdout).toBe("antes");
    expect(r.error).toMatch(/Agregar entrada/);
  });

  it("corta un ciclo infinito", () => {
    const r = runPseint(`Algoritmo I\n Mientras Verdadero Hacer\n x <- 1\n FinMientras\nFinAlgoritmo`, [], {
      maxSteps: 5000,
    });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/ciclo infinito/);
  });

  it("falta cerrar un bloque", () => {
    const r = run(`Algoritmo E\n Si 1 = 1 Entonces\n Escribir "x"\nFinAlgoritmo`);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/FinSi/);
  });

  it("una variable que empieza con «fin» no se confunde con FinSi", () => {
    const r = run(`Algoritmo V\n final <- 3\n Escribir final\nFinAlgoritmo`);
    expect(r.ok).toBe(true);
    expect(r.stdout).toBe("3");
  });
});

describe("PSeInt: modo interactivo", () => {
  const code = `Algoritmo Suma
    Escribir "Primer numero:" Sin Saltar
    Leer a
    Escribir "Segundo numero:" Sin Saltar
    Leer b
    Escribir "Suma: ", a + b
  FinAlgoritmo`;
  const inter = (inputs: string[]) => runPseint(code, inputs, { interactive: true, seed: 1 });

  it("se detiene en cada Leer esperando el dato", () => {
    const r0 = inter([]);
    expect(r0.waiting).toBe(true);
    expect(r0.ok).toBe(true);
    expect(r0.stdout).toBe("Primer numero:");

    const r1 = inter(["4"]);
    expect(r1.waiting).toBe(true);
    expect(r1.stdout).toBe("Primer numero:4\nSegundo numero:");
  });

  it("termina cuando ya están todos los datos y muestra lo escrito", () => {
    const r = inter(["4", "5"]);
    expect(r.waiting).toBe(false);
    expect(r.ok).toBe(true);
    expect(r.stdout).toBe("Primer numero:4\nSegundo numero:5\nSuma: 9");
  });

  it("Azar da lo mismo al re-ejecutar con la misma semilla", () => {
    const azar = `Algoritmo Z\n x <- Azar(1000)\n Leer y\n Escribir x\nFinAlgoritmo`;
    const a = runPseint(azar, ["1"], { interactive: true, seed: 42 });
    const b = runPseint(azar, ["1"], { interactive: true, seed: 42 });
    expect(a.stdout).toBe(b.stdout);
  });
});

describe("PSeInt: ejercicio de compra y financiación", () => {
  const code = `Algoritmo Compra
    Definir presupuesto, precio, edad Como Real
    Definir tarjeta, formaPago Como Caracter
    Escribir "Presupuesto:"
    Leer presupuesto
    Escribir "Precio:"
    Leer precio
    Escribir "Edad:"
    Leer edad
    Escribir "Tarjeta (SI/NO):"
    Leer tarjeta
    Si edad >= 18 Y presupuesto >= precio Entonces
      Escribir "Compra de contado aprobada"
    SiNo
      Si edad >= 18 Y tarjeta = "SI" Entonces
        Escribir "Compra financiada aprobada"
      SiNo
        Escribir "No puede adquirir el equipo"
      FinSi
    FinSi
  FinAlgoritmo`;

  it("contado", () => {
    expect(run(code, ["3000", "2500", "20", "NO"]).stdout).toContain("Compra de contado aprobada");
  });
  it("financiado", () => {
    expect(run(code, ["1000", "2500", "20", "SI"]).stdout).toContain("Compra financiada aprobada");
  });
  it("rechazado", () => {
    expect(run(code, ["1000", "2500", "16", "SI"]).stdout).toContain("No puede adquirir");
  });
});
