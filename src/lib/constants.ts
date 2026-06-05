import type { Difficulty, ProgLanguage } from "@/types/database";

export const LANGUAGE_META: Record<
  ProgLanguage,
  { label: string; monaco: string; emoji: string }
> = {
  pseint: { label: "PSeInt", monaco: "pascal", emoji: "📘" },
  java: { label: "Java", monaco: "java", emoji: "☕" },
  python: { label: "Python", monaco: "python", emoji: "🐍" },
  logic: { label: "Lógica", monaco: "plaintext", emoji: "🧩" },
};

export const DIFFICULTY_META: Record<
  Difficulty,
  { label: string; className: string }
> = {
  beginner: {
    label: "Principiante",
    className: "bg-success/15 text-success",
  },
  easy: { label: "Fácil", className: "bg-accent/15 text-accent" },
  medium: { label: "Medio", className: "bg-warning/15 text-warning" },
  hard: { label: "Difícil", className: "bg-destructive/15 text-destructive" },
};

// Paleta de colores para cursos (clave guardada en courses.color)
export const COURSE_COLORS: Record<
  string,
  { label: string; gradient: string; dot: string }
> = {
  violet: {
    label: "Violeta",
    gradient: "from-violet-500 to-fuchsia-500",
    dot: "bg-violet-500",
  },
  teal: {
    label: "Teal",
    gradient: "from-teal-400 to-cyan-500",
    dot: "bg-teal-500",
  },
  amber: {
    label: "Ámbar",
    gradient: "from-amber-400 to-orange-500",
    dot: "bg-amber-500",
  },
  rose: {
    label: "Rosa",
    gradient: "from-rose-400 to-pink-500",
    dot: "bg-rose-500",
  },
  emerald: {
    label: "Esmeralda",
    gradient: "from-emerald-400 to-green-500",
    dot: "bg-emerald-500",
  },
  blue: {
    label: "Azul",
    gradient: "from-blue-500 to-indigo-500",
    dot: "bg-blue-500",
  },
};

export const COURSE_COLOR_KEYS = Object.keys(COURSE_COLORS);

// Plantilla de código base por lenguaje (esqueleto inicial para empezar).
export const STARTER_CODE: Record<ProgLanguage, string> = {
  pseint: `Algoritmo MiPrograma\n\t// Escribe tu solución aquí\n\tEscribir "Hola Mundo"\nFinAlgoritmo`,
  java: `public class Main {\n    public static void main(String[] args) {\n        // Escribe tu código aquí\n        System.out.println("Hola Mundo");\n    }\n}`,
  python: `# Escribe tu código aquí\nprint("Hola Mundo")`,
  logic: `// Describe tu solución paso a paso\n1. ...\n2. ...`,
};
