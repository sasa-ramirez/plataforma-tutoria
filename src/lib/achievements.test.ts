import { describe, it, expect } from "vitest";
import { computeAchievements, ACHIEVEMENTS, type GameStats } from "./achievements";

const zeroStats: GameStats = { xp: 0, streak: 0, gradedCount: 0, bestScore: 0, weekCount: 0 };

describe("computeAchievements", () => {
  it("con stats en cero, nada está desbloqueado y el progreso es 0%", () => {
    const result = computeAchievements(zeroStats);
    expect(result).toHaveLength(ACHIEVEMENTS.length);
    for (const a of result) {
      expect(a.unlocked).toBe(false);
      expect(a.progress).toBe(0);
      expect(a.value).toBe(0);
    }
  });

  it("desbloquea 'first_step' con 1 ejercicio calificado, pero no 'unstoppable' (necesita 10)", () => {
    const result = computeAchievements({ ...zeroStats, gradedCount: 1 });
    const firstStep = result.find((a) => a.id === "first_step")!;
    const unstoppable = result.find((a) => a.id === "unstoppable")!;
    expect(firstStep.unlocked).toBe(true);
    expect(firstStep.progress).toBe(100);
    expect(unstoppable.unlocked).toBe(false);
    expect(unstoppable.progress).toBe(10); // 1/10 = 10%
  });

  it("no deja que el progreso pase de 100% aunque el valor real supere la meta", () => {
    // Si alguna vez gradedCount llega a 999, "marathon" (meta 25) no debe
    // mostrar 3996% ni un value mayor a la meta.
    const result = computeAchievements({ ...zeroStats, gradedCount: 999 });
    const marathon = result.find((a) => a.id === "marathon")!;
    expect(marathon.value).toBe(25);
    expect(marathon.progress).toBe(100);
    expect(marathon.unlocked).toBe(true);
  });

  it("cada logro mide la métrica correcta (racha vs ejercicios vs XP vs mejor nota)", () => {
    const result = computeAchievements({
      xp: 500,
      streak: 7,
      gradedCount: 0,
      bestScore: 100,
      weekCount: 0,
    });
    expect(result.find((a) => a.id === "xp500")!.unlocked).toBe(true);
    expect(result.find((a) => a.id === "streak7")!.unlocked).toBe(true);
    expect(result.find((a) => a.id === "perfect")!.unlocked).toBe(true);
    // gradedCount sigue en 0 -> los que dependen de ejercicios no se desbloquean.
    expect(result.find((a) => a.id === "first_step")!.unlocked).toBe(false);
  });
});
