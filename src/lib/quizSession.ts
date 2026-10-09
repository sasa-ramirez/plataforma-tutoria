/** Helpers de una sesión de quiz con hora de cierre ("tarea abierta"). */

type WithClose = { closes_at?: string | null };

/** ¿Ya pasó la hora de cierre? (el servidor lo impone igual; esto es para mostrarlo bien). */
export function isExpired(s: WithClose, now = Date.now()): boolean {
  return !!s.closes_at && new Date(s.closes_at).getTime() <= now;
}

/** "mié 9 oct, 10:30 p. m." */
export function fmtDeadline(iso: string): string {
  return new Date(iso).toLocaleString("es-CO", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Valor para <input type="datetime-local"> (hora local, sin zona) a partir de ahora + N horas. */
export function localDateTimeInput(plusHours: number): string {
  const d = new Date(Date.now() + plusHours * 3_600_000);
  d.setMinutes(0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
