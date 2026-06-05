// Web Push (notificaciones con la app cerrada).
// Es ADITIVO: si no hay clave VAPID configurada o el navegador no lo soporta,
// no hace nada y la app funciona igual.

import { supabase } from "@/lib/supabase";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as
  | string
  | undefined;

export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    !!VAPID_PUBLIC_KEY
  );
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/**
 * Registra el service worker, se suscribe a push y guarda la suscripción en la
 * BD. Llamar solo tras tener permiso de notificaciones (gesto del usuario).
 */
export async function enablePush(): Promise<boolean> {
  if (!isPushSupported()) return false;
  if (Notification.permission !== "granted") return false;

  try {
    const reg = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;

    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          VAPID_PUBLIC_KEY as string,
        ) as BufferSource,
      });
    }

    const json = sub.toJSON() as {
      endpoint?: string;
      keys?: { p256dh?: string; auth?: string };
    };
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth?.user?.id;
    if (!uid || !json.endpoint) return false;

    await supabase.from("push_subscriptions").upsert(
      {
        user_id: uid,
        endpoint: json.endpoint,
        p256dh: json.keys?.p256dh ?? "",
        auth: json.keys?.auth ?? "",
      },
      { onConflict: "endpoint" },
    );
    return true;
  } catch {
    return false;
  }
}
