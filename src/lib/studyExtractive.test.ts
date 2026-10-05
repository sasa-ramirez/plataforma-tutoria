import { describe, it, expect } from "vitest";
import { extractiveNotes } from "./studyExtractive";

const slide = (title: string, ...bullets: string[]) => [title, ...bullets.map((b) => `• ${b}`)].join("\n");

describe("extractiveNotes", () => {
  it("arma temas con título, resumen y puntos clave a partir de diapositivas", () => {
    const pages = [
      slide(
        "Segmentación de redes",
        "Divide una red grande en subredes más pequeñas",
        "Reduce el tráfico de difusión y mejora la seguridad",
        "Se logra con máscaras de subred y routers",
        "Cada subred tiene su propio rango de direcciones IP",
      ),
      slide("VLSM", "Máscara de longitud variable", "Permite ajustar el tamaño de cada subred", "Optimiza el uso de direcciones IP en la red"),
    ];
    const notes = extractiveNotes(pages, 1, "Diapositiva", 200);
    expect(notes.length).toBeGreaterThanOrEqual(1);
    expect(notes[0].topic).toBe("Segmentación de redes");
    expect(notes[0].summary).toContain("Divide una red grande");
    expect(notes.flatMap((n) => n.key_points).join(" ")).not.toContain("•"); // viñetas limpias
  });

  it("agrupa diapositivas cortas en pocos temas y no deja temas sueltos de una línea", () => {
    const pages = Array.from({ length: 12 }, (_, i) =>
      slide(`Tema ${i + 1}`, "Una idea corta pero real de la clase", "Otra idea que se explica aquí"),
    );
    const notes = extractiveNotes(pages, 1, "Diapositiva", 1100);
    expect(notes.length).toBeLessThan(12);
    expect(notes.length).toBeGreaterThanOrEqual(2);
  });

  it("ignora portadas casi vacías y títulos genéricos", () => {
    const pages = ["Hola", slide("Agenda", "Introducción y objetivos de hoy para la sesión de clase"), slide("Protocolo TCP", "Orientado a conexión y confiable", "Control de flujo y de congestión en la red")];
    const notes = extractiveNotes(pages, 1, "Diapositiva", 150);
    expect(notes.map((n) => n.topic)).not.toContain("Agenda");
    expect(notes.some((n) => n.topic === "Protocolo TCP")).toBe(true);
  });

  it("sin título claro usa 'Página N'", () => {
    const largo = "Esta es una frase muy larga que parece un párrafo completo y no un título de diapositiva, termina con punto.";
    const notes = extractiveNotes([`${largo}\nOtra línea de contenido con bastante texto para pasar el mínimo.`], 7, "Página");
    expect(notes[0].topic).toBe("Página 7");
  });

  it("no inventa nada con páginas vacías", () => {
    expect(extractiveNotes(["", "  ", "ok"], 1, "Página")).toEqual([]);
  });

  it("respeta límites de tamaño", () => {
    const big = Array.from({ length: 30 }, (_, i) => `Línea de contenido número ${i} con texto suficiente para contar`).join("\n");
    const n = extractiveNotes([`Título grande\n${big}`], 1, "Página")[0];
    expect(n.summary.length).toBeLessThanOrEqual(700);
    expect(n.key_points.length).toBeLessThanOrEqual(8);
    expect(n.topic.length).toBeLessThanOrEqual(80);
  });
});
