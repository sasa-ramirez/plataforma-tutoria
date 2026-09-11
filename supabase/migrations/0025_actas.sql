-- ============================================================
-- 0025 — Actas de reunión con el grupo (AD-F-01)
-- Guarda el acta que el tutor levanta en cada encuentro (orden del día,
-- desarrollo, conclusiones, compromisos, observaciones). Sin foto ni
-- storage: las firmas quedan en blanco en el Word para firmar a mano,
-- igual que hoy. Aditivo. Idempotente.
-- ============================================================

create table if not exists actas (
  id             uuid primary key default gen_random_uuid(),
  course_id      uuid not null references courses(id) on delete cascade,
  tutor_id       uuid not null references profiles(id) on delete cascade,
  tutor_name     text,
  acta_number    text,
  acta_date      date not null default current_date,
  organismo      text not null default 'Permanencia y Graduación Exitosa',
  asunto         text,
  program_name   text,
  professor_name text,
  orden_dia      text,
  desarrollo     text not null,
  conclusiones   text,
  compromisos    text,
  observaciones  text,
  created_at     timestamptz not null default now()
);
create index if not exists idx_actas_course on actas(course_id, acta_date desc);

alter table actas enable row level security;

drop policy if exists "actas write" on actas;
create policy "actas write" on actas for all
  using (owns_course(course_id)) with check (owns_course(course_id));

drop policy if exists "actas read" on actas;
create policy "actas read" on actas for select
  using (owns_course(course_id) or can_view_reports());
