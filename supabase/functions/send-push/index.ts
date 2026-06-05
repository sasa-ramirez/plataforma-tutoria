// Supabase Edge Function: send-push
// Envía una notificación Web Push a todos los dispositivos de un usuario.
// La invoca un Database Webhook de Supabase al INSERTAR en `notifications`.
//
// Despliegue:
//   supabase functions deploy send-push --no-verify-jwt
//   supabase secrets set VAPID_PUBLIC_KEY=...
//   supabase secrets set VAPID_PRIVATE_KEY=...
//   supabase secrets set VAPID_SUBJECT=mailto:tucorreo@dominio.com
//   supabase secrets set PUSH_WEBHOOK_SECRET=<un-secreto-largo>
//
// Webhook (Dashboard → Database → Webhooks): tabla notifications, evento
// INSERT, tipo HTTP Request → URL de esta función, cabecera:
//   x-push-secret: <el mismo PUSH_WEBHOOK_SECRET>

import { createClient } from "jsr:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@kodea.app";
const PUSH_WEBHOOK_SECRET = Deno.env.get("PUSH_WEBHOOK_SECRET") ?? "";

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

Deno.serve(async (req) => {
  try {
    // Protección: solo acepta llamadas con el secreto compartido del webhook.
    if (
      PUSH_WEBHOOK_SECRET &&
      req.headers.get("x-push-secret") !== PUSH_WEBHOOK_SECRET
    ) {
      return new Response(JSON.stringify({ ok: false, error: "no autorizado" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    // El webhook de Supabase manda { type, table, record, old_record }.
    const record = body.record ?? body;
    const userId: string | undefined = record.user_id;
    const title: string = record.title ?? "Kódea";
    const text: string | null = record.body ?? null;
    const link: string | null = record.link ?? null;
    if (!userId) throw new Error("falta user_id");

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: subs } = await admin
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("user_id", userId);

    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0 }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const payload = JSON.stringify({ title, body: text, link });
    let sent = 0;
    const stale: string[] = [];

    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: s.endpoint,
              keys: { p256dh: s.p256dh, auth: s.auth },
            },
            payload,
          );
          sent++;
        } catch (e) {
          // 404/410 = suscripción caducada → la borramos.
          const code = (e as { statusCode?: number }).statusCode;
          if (code === 404 || code === 410) stale.push(s.id);
        }
      }),
    );

    if (stale.length > 0) {
      await admin.from("push_subscriptions").delete().in("id", stale);
    }

    return new Response(JSON.stringify({ ok: true, sent }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "error";
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
});
