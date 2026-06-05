-- ============================================================
-- 0010 — Suscripciones de Web Push (notificaciones con la app cerrada)
-- La Edge Function send-push usa estas filas (service-role) para enviar.
-- Ejecutar DESPUÉS de 0001-0009. Idempotente.
-- ============================================================

create table if not exists push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles(id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_push_user on push_subscriptions(user_id);

alter table push_subscriptions enable row level security;

-- Cada quien administra solo sus propias suscripciones.
drop policy if exists "push own all" on push_subscriptions;
create policy "push own all" on push_subscriptions for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
