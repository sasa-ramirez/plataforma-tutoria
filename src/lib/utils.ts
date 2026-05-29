import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function initials(name?: string | null) {
  if (!name) return "??";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase())
    .join("");
}

/** Devuelve true si la tarea está abierta según su ventana de tiempo. */
export function isAssignmentOpen(a: {
  status: string;
  opens_at: string | null;
  closes_at: string | null;
}) {
  if (a.status !== "open") return false;
  const now = Date.now();
  if (a.opens_at && new Date(a.opens_at).getTime() > now) return false;
  if (a.closes_at && new Date(a.closes_at).getTime() < now) return false;
  return true;
}

export function timeLeft(closesAt: string | null): string | null {
  if (!closesAt) return null;
  const diff = new Date(closesAt).getTime() - Date.now();
  if (diff <= 0) return "Cerrada";
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
