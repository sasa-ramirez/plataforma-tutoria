import { Flame, Footprints, Gem, Sprout, Star, Target, Zap, type LucideIcon } from "lucide-react";

/** Stats reales del estudiante con los que se calculan los logros. */
export interface GameStats {
  xp: number;
  streak: number;
  gradedCount: number;
  bestScore: number;
  weekCount: number;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  goal: number;
  current: (s: GameStats) => number;
}

/** Catálogo de logros. El progreso se deriva de datos reales. */
export const ACHIEVEMENTS: Achievement[] = [
  {
    id: "first_step",
    title: "Primer paso",
    description: "Completa tu primer ejercicio",
    icon: Sprout,
    goal: 1,
    current: (s) => s.gradedCount,
  },
  {
    id: "unstoppable",
    title: "Imparable",
    description: "Completa 10 ejercicios",
    icon: Zap,
    goal: 10,
    current: (s) => s.gradedCount,
  },
  {
    id: "marathon",
    title: "Maratonista",
    description: "Completa 25 ejercicios",
    icon: Footprints,
    goal: 25,
    current: (s) => s.gradedCount,
  },
  {
    id: "streak3",
    title: "En racha",
    description: "Programa 3 días seguidos",
    icon: Flame,
    goal: 3,
    current: (s) => s.streak,
  },
  {
    id: "streak7",
    title: "Una semana imparable",
    description: "Programa 7 días seguidos",
    icon: Star,
    goal: 7,
    current: (s) => s.streak,
  },
  {
    id: "perfect",
    title: "Perfeccionista",
    description: "Consigue un 100 en un ejercicio",
    icon: Target,
    goal: 100,
    current: (s) => s.bestScore,
  },
  {
    id: "xp500",
    title: "Cazador de XP",
    description: "Acumula 500 XP",
    icon: Gem,
    goal: 500,
    current: (s) => s.xp,
  },
];

export interface ComputedAchievement extends Achievement {
  value: number;
  unlocked: boolean;
  progress: number; // 0..100
}

export function computeAchievements(stats: GameStats): ComputedAchievement[] {
  return ACHIEVEMENTS.map((a) => {
    const value = Math.min(a.current(stats), a.goal);
    return {
      ...a,
      value,
      unlocked: value >= a.goal,
      progress: Math.round((value / a.goal) * 100),
    };
  });
}

/** Reto semanal fijo (se reinicia cada semana con weekCount). */
export const WEEKLY_GOAL = 3;
