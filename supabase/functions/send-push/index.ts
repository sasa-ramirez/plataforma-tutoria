// Supabase Edge Function: send-push
// Modo SONDEO (polling): algo de afuera (ver .github/workflows/push-poller.yml)
// la llama cada pocos minutos. Ella misma busca en `notifications` las que
// no se han mandado (pushed_at is null) y les manda Web Push a todos los
// dispositivos suscritos de cada usuario.
//
// Por qué así y no con un Database Webhook: pg_net (adentro de la base de
// datos de este proyecto) no puede resolver su propio dominio *.supabase.co,
// así que la base de datos nunca puede llamarse a sí misma. Ver 0030_push_polling.sql.
//
// Despliegue:
//   supabase functions deploy send-push --no-verify-jwt
//   supabase secrets set VAPID_PUBLIC_KEY=...
//   supabase secrets set VAPID_PRIVATE_KEY=...
//   supabase secrets set VAPID_SUBJECT=mailto:tucorreo@dominio.com
//   supabase secrets set PUSH_WEBHOOK_SECRET=<un-secreto-largo>
//
// Quien llame debe mandar la cabecera: x-push-secret: <PUSH_WEBHOOK_SECRET>

import { createClient } from "jsr:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@kodea.app";
const PUSH_WEBHOOK_SECRET = Deno.env.get("PUSH_WEBHOOK_SECRET") ?? "";

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

interface NotificationRow {
  id: string;
  user_id: string;
  title: string;
  body: string | null;
  link: string | null;
}

Deno.serve(async (req) => {
  try {
    if (
      PUSH_WEBHOOK_SECRET &&
      req.headers.get("x-push-secret") !== PUSH_WEBHOOK_SECRET
    ) {
      return new Response(JSON.stringify({ ok: false, error: "no autorizado" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Lote razonable por corrida — el poller vuelve a llamar cada pocos
    // minutos, así que no hace falta procesar miles de una vez.
    const { data: pending, error: fetchErr } = await admin
      .from("notifications")
      .select("id, user_id, title, body, link")
      .is("pushed_at", null)
      .order("created_at", { ascending: true })
      .limit(200);
    if (fetchErr) throw fetchErr;

    const notifications = (pending ?? []) as NotificationRow[];
    if (notifications.length === 0) {
      return new Response(JSON.stringify({ ok: true, processed: 0, sent: 0 }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const userIds = [...new Set(notifications.map((n) => n.user_id))];
    const { data: subs } = await admin
      .from("push_subscriptions")
      .select("id, user_id, endpoint, p256dh, auth")
      .in("user_id", userIds);

    const subsByUser = new Map<string, typeof subs>();
    for (const s of subs ?? []) {
      const list = subsByUser.get(s.user_id) ?? [];
      list.push(s);
      subsByUser.set(s.user_id, list);
    }

    let sent = 0;
    const staleIds: string[] = [];

    await Promise.all(
      notifications.map(async (n) => {
        const userSubs = subsByUser.get(n.user_id) ?? [];
        const payload = JSON.stringify({
          title: n.title,
          body: n.body,
          link: n.link,
        });
        await Promise.all(
          userSubs.map(async (s) => {
            try {
              await webpush.sendNotification(
                { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
                payload,
              );
              sent++;
              console.log(`OK envio a ${s.endpoint.slice(0, 60)}...`);
            } catch (e) {
              const code = (e as { statusCode?: number }).statusCode;
              const body = (e as { body?: string }).body;
              const message = e instanceof Error ? e.message : String(e);
              console.error(
                `FALLO envio a ${s.endpoint.slice(0, 60)}... status=${code} message=${message} body=${body}`,
              );
              if (code === 404 || code === 410) staleIds.push(s.id);
            }
          }),
        );
      }),
    );

    if (staleIds.length > 0) {
      await admin.from("push_subscriptions").delete().in("id", staleIds);
    }

    // Se marcan como procesadas aunque el usuario no tuviera ninguna
    // suscripción activa — ya se intentó, no hay nada más que reintentar.
    await admin
      .from("notifications")
      .update({ pushed_at: new Date().toISOString() })
      .in(
        "id",
        notifications.map((n) => n.id),
      );

    return new Response(
      JSON.stringify({ ok: true, processed: notifications.length, sent }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "error";
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
});
