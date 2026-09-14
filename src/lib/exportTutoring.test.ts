import { describe, it, expect } from "vitest";
import { splitName } from "./exportTutoring";

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
