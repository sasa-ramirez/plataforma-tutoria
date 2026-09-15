-- ============================================================
-- 0029 — Dispara el push real cuando se crea una notificación
-- En vez de un Database Webhook desde el dashboard (esa pantalla no
-- aparece en algunos proyectos), la base de datos llama directo a la
-- Edge Function `send-push` con pg_net cada vez que se inserta una fila
-- en `notifications`. Mismo efecto que un webhook, sin depender de esa
-- pantalla del dashboard.
--
-- IMPORTANTE: esta migración NO trae el secreto — eso se configura
-- aparte (ver instrucciones), para no dejarlo guardado en el código.
-- Aditivo. Idempotente.
-- ============================================================

create extension if not exists pg_net;

create or replace function trigger_send_push()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  secret text := current_setting('app.push_webhook_secret', true);
begin
  if secret is null or secret = '' then
    -- Todavía no se configuró el secreto: no intenta mandar nada
    -- (evita que fallen los inserts en notifications por esto).
    return new;
  end if;

  perform net.http_post(
    url := 'https://npnndpgkfragpdvksrlv.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-push-secret', secret
    ),
    body := jsonb_build_object('record', to_jsonb(new))
  );
  return new;
end; $$;

drop trigger if exists t_send_push on notifications;
create trigger t_send_push after insert on notifications
  for each row execute function trigger_send_push();
