import { describe, it, expect, vi, afterEach } from "vitest";
import { initials, isAssignmentOpen, timeLeft } from "./utils";

describe("initials", () => {
  it("toma la primera letra de las primeras dos palabras", () => {
    expect(initials("Samuel Santiago Bonivento Ramirez")).toBe("SS");
  });
  it("funciona con un solo nombre", () => {
    expect(initials("Samuel")).toBe("S");
  });
  it("devuelve '??' si no hay nombre", () => {
    expect(initials(null)).toBe("??");
    expect(initials(undefined)).toBe("??");
    expect(initials("")).toBe("??");
  });
});

describe("isAssignmentOpen", () => {
  afterEach(() => vi.useRealTimers());

  it("cerrada si el status no es 'open'", () => {
    expect(isAssignmentOpen({ status: "draft", opens_at: null, closes_at: null })).toBe(false);
  });

  it("abierta si status='open' y no tiene ventana de tiempo", () => {
    expect(isAssignmentOpen({ status: "open", opens_at: null, closes_at: null })).toBe(true);
  });

  it("cerrada si todavía no llega la fecha de apertura", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    expect(
      isAssignmentOpen({ status: "open", opens_at: "2026-01-02T00:00:00Z", closes_at: null }),
    ).toBe(false);
  });

  it("cerrada si ya pasó la fecha de cierre", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-03T00:00:00Z"));
    expect(
      isAssignmentOpen({ status: "open", opens_at: null, closes_at: "2026-01-02T00:00:00Z" }),
    ).toBe(false);
  });

  it("abierta justo dentro de la ventana", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T12:00:00Z"));
    expect(
      isAssignmentOpen({
        status: "open",
        opens_at: "2026-01-01T00:00:00Z",
        closes_at: "2026-01-02T00:00:00Z",
      }),
    ).toBe(true);
  });
});

describe("timeLeft", () => {
  afterEach(() => vi.useRealTimers());

  it("null si no hay fecha de cierre", () => {
    expect(timeLeft(null)).toBeNull();
  });

  it("'Cerrada' si ya pasó la fecha", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-02T00:00:00Z"));
    expect(timeLeft("2026-01-01T00:00:00Z")).toBe("Cerrada");
  });

  it("muestra días y horas cuando falta más de un día", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    expect(timeLeft("2026-01-03T05:00:00Z")).toBe("2d 5h");
  });

  it("muestra solo minutos cuando falta menos de una hora", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    expect(timeLeft("2026-01-01T00:30:00Z")).toBe("30m");
  });
});
