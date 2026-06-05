// Notificaciones del navegador (Web Notifications API).
// Esto muestra un aviso del sistema cuando la app está ABIERTA (aunque la
// pestaña esté en segundo plano). El push con la app cerrada es otra cosa
// (Web Push + service worker) y se monta aparte.

export function canNotify(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

/** Pide permiso (idealmente tras un gesto del usuario, p. ej. abrir la campanita). */
export async function ensureNotifyPermission(): Promise<boolean> {
  if (!canNotify()) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  try {
    const res = await Notification.requestPermission();
    return res === "granted";
  } catch {
    return false;
  }
}

/** Muestra un aviso del sistema si hay permiso. Al hacer clic, abre el enlace. */
export function showBrowserNotification(
  title: string,
  body?: string | null,
  link?: string | null,
) {
  if (!canNotify() || Notification.permission !== "granted") return;
  try {
    const n = new Notification(title, {
      body: body ?? undefined,
      icon: "/favicon.svg",
      badge: "/favicon.svg",
    });
    if (link) {
      n.onclick = () => {
        window.focus();
        window.location.assign(link);
      };
    }
  } catch {
    /* algunos navegadores requieren service worker; se ignora silenciosamente */
  }
}

/** Pitido corto generado (sin archivo) para avisar de algo en vivo. */
export function playPing() {
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25);
    osc.start();
    osc.stop(ctx.currentTime + 0.26);
    osc.onended = () => ctx.close();
  } catch {
    /* sin audio disponible */
  }
}
