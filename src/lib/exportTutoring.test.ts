import { describe, it, expect } from "vitest";
import { splitName, parseScheduleByDay } from "./exportTutoring";

describe("splitName", () => {
  it("reparte 4 palabras en 2+2 (nombre y apellido colombianos típicos)", () => {
    expect(splitName("Samuel Santiago Bonivento Ramirez")).toEqual({
      nombre: "Samuel Santiago",
      apellidos: "Bonivento Ramirez",
    });
  });

  it("con 3 palabras, redondea hacia arriba para el nombre (2+1)", () => {
    expect(splitName("Juan Carlos Perez")).toEqual({
      nombre: "Juan Carlos",
      apellidos: "Perez",
    });
  });

  it("con un solo nombre, no hay apellido", () => {
    expect(splitName("Samuel")).toEqual({ nombre: "Samuel", apellidos: "" });
  });

  it("nulo o vacío da ambos campos vacíos", () => {
    expect(splitName(null)).toEqual({ nombre: "", apellidos: "" });
    expect(splitName("   ")).toEqual({ nombre: "", apellidos: "" });
  });
});

describe("parseScheduleByDay", () => {
  it("reconoce el día en mayúsculas, como lo guarda el editor manual", () => {
    const { byDay, other } = parseScheduleByDay(
      "LUNES 09:00 A.M - 10:30 A.M\nMIÉRCOLES 09:00 A.M - 10:30 A.M",
    );
    expect(byDay.get("Lunes")).toEqual(["09:00 A.M - 10:30 A.M"]);
    expect(byDay.get("Miércoles")).toEqual(["09:00 A.M - 10:30 A.M"]);
    expect(other).toEqual([]);
  });

  it("reconoce nombres de día con tilde y sin tilde, y abreviaturas", () => {
    expect(parseScheduleByDay("Miercoles 4-6pm").byDay.get("Miércoles")).toEqual(["4-6pm"]);
    expect(parseScheduleByDay("Sab 8am").byDay.get("Sábado")).toEqual(["8am"]);
    expect(parseScheduleByDay("Sábados 8am-10am").byDay.get("Sábado")).toEqual(["8am-10am"]);
  });

  it("una línea sin día reconocible se guarda como 'other', no se pierde", () => {
    const { byDay, other } = parseScheduleByDay("Se reunirán cuando puedan");
    expect(byDay.size).toBe(0);
    expect(other).toEqual(["Se reunirán cuando puedan"]);
  });

  it("dos horarios el mismo día se juntan en la lista de ese día", () => {
    const { byDay } = parseScheduleByDay("Lunes 8-10am\nLunes 2-4pm");
    expect(byDay.get("Lunes")).toEqual(["8-10am", "2-4pm"]);
  });

  it("vacío o nulo no rompe nada", () => {
    expect(parseScheduleByDay(null)).toEqual({ byDay: new Map(), other: [] });
    expect(parseScheduleByDay("")).toEqual({ byDay: new Map(), other: [] });
  });
});
