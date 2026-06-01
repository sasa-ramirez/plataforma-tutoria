-- ============================================================
-- 0005 — Rate limit de IA (control de costos)
-- Registra cada llamada a la IA por estudiante para limitar abuso.
-- Ejecutar DESPUÉS de 0001-0004. Idempotente.
-- ============================================================

create table if not exists ai_usage (
  id         uuid primary key default gen_random_uuid(),
  student_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists idx_ai_usage_student_time
  on ai_usage(student_id, created_at);

-- RLS activado SIN políticas para clientes: nadie lo lee/escribe desde la app.
-- La Edge Function usa la service-role key, que ignora RLS.
alter table ai_usage enable row level security;
