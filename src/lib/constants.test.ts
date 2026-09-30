import { describe, it, expect } from "vitest";
import { assignmentBadge, LANGUAGE_META } from "./constants";

describe("assignmentBadge", () => {
  it("con lenguaje de código, siempre muestra el lenguaje (nunca la materia)", () => {
    expect(assignmentBadge("python", "Derecho Civil")).toEqual(LANGUAGE_META.python);
    expect(assignmentBadge("java", "Derecho Civil")).toEqual(LANGUAGE_META.java);
    expect(assignmentBadge("pseint", "Derecho Civil")).toEqual(LANGUAGE_META.pseint);
  });

  it("con 'logic' y materia conocida, muestra la materia en vez de 'Lógica'", () => {
    const badge = assignmentBadge("logic", "Psicología del Desarrollo", "Facultad de Ciencias Sociales y Humanas");
    expect(badge.label).toBe("Psicología del Desarrollo");
    expect(badge.icon).not.toBe(LANGUAGE_META.logic.icon);
  });

  it("usa un ícono distinto según la facultad", () => {
    const ingenieria = assignmentBadge("logic", "Redes", "Facultad de Ingeniería");
    const salud = assignmentBadge("logic", "Fisiología", "Facultad de Ciencias de la Salud");
    expect(ingenieria.icon).not.toBe(salud.icon);
  });

  it("con materia conocida pero facultad ausente/desconocida, cae en el ícono genérico", () => {
    expect(assignmentBadge("logic", "Redes", null).icon).toBe(
      assignmentBadge("logic", "Otra materia", "Facultad Inexistente").icon,
    );
  });

  it("con 'logic' y sin materia (curso sin asignatura o aún cargando), cae en 'Lógica'", () => {
    expect(assignmentBadge("logic", null)).toEqual(LANGUAGE_META.logic);
    expect(assignmentBadge("logic", undefined)).toEqual(LANGUAGE_META.logic);
    expect(assignmentBadge("logic", "")).toEqual(LANGUAGE_META.logic);
  });
});
