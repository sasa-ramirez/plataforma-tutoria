import {
  Coffee,
  Cog,
  FlaskConical,
  GraduationCap,
  Landmark,
  NotebookPen,
  Puzzle,
  Stethoscope,
  Terminal,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { Difficulty, ProgLanguage } from "@/types/database";

export const LANGUAGE_META: Record<
  ProgLanguage,
  { label: string; monaco: string; icon: LucideIcon }
> = {
  pseint: { label: "PSeInt", monaco: "pascal", icon: NotebookPen },
  java: { label: "Java", monaco: "java", icon: Coffee },
  python: { label: "Python", monaco: "python", icon: Terminal },
  logic: { label: "Lógica", monaco: "plaintext", icon: Puzzle },
};

// Ícono por FACULTAD (no por cada una de las ~20 carreras del catálogo: con
// 6 facultades ya se cubre todo, y una carrera nueva que agregue la
// universidad hereda el ícono de su facultad sin tocar código).
const FACULTY_ICON: Record<string, LucideIcon> = {
  "Facultad de Ingeniería": Cog,
  "Facultad de Ciencias Económicas y Administrativas": Landmark,
  "Facultad de Ciencias de la Educación": GraduationCap,
  "Facultad de Ciencias Básicas y Aplicadas": FlaskConical,
  "Facultad de Ciencias Sociales y Humanas": Users,
  "Facultad de Ciencias de la Salud": Stethoscope,
};

/**
 * Insignia de una tarea: si NO es de código ("Lógica") y el curso tiene
 * asignatura en el catálogo, se muestra esa asignatura (p. ej. "Derecho
 * Civil") con el ícono de su facultad, en vez del ícono/etiqueta genérico
 * de "Lógica" — así una tarea de Derecho o Psicología no se ve como si
 * fuera de programación.
 */
export function assignmentBadge(
  language: ProgLanguage,
  subjectName?: string | null,
  facultyName?: string | null,
): { icon: LucideIcon; label: string } {
  if (language === "logic" && subjectName) {
    return { icon: FACULTY_ICON[facultyName ?? ""] ?? GraduationCap, label: subjectName };
  }
  return LANGUAGE_META[language];
}

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
