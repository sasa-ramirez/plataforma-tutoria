-- ============================================================
-- 0030 — Cambia el push a modelo de "sondeo" (polling) externo
-- Se descubrió que pg_net no puede resolver el propio dominio
-- *.supabase.co de este proyecto (restricción de la plataforma, no de
-- código) — así que la base de datos nunca va a poder llamarse a sí
-- misma para mandar el push. Se quita ese intento (quedaba fallando en
-- net._http_response) y en su lugar la función send-push pasa a
-- funcionar en modo "sondeo": algo de AFUERA (GitHub Actions, ver
-- .github/workflows/push-poller.yml) la llama cada pocos minutos, ella
-- misma busca qué notificaciones no se han mandado y las manda.
-- Aditivo. Idempotente.
-- ============================================================

-- Ya no se necesita: era el intento fallido de llamar a send-push desde
-- adentro de la base de datos.
drop trigger if exists t_send_push on notifications;
drop function if exists trigger_send_push();

-- Para que send-push sepa cuáles ya mandó y no repita.
alter table notifications add column if not exists pushed_at timestamptz;
create index if not exists idx_notif_unpushed on notifications(created_at)
  where pushed_at is null;
