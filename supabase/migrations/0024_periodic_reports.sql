-- ============================================================
-- 0024 — Informe periódico de actividades (BS-F-17)
-- Guarda el informe que el tutor entrega por corte (lugar, grupo,
-- temas, descripción, observaciones) con una foto de evidencia que
-- sube desde el celular. Bucket privado: solo el tutor dueño del
-- curso y coordinación pueden ver las fotos. Aditivo. Idempotente.
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('report-photos', 'report-photos', false, 8388608, array['image/jpeg','image/png','image/webp','image/heic'])
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- El path de cada archivo empieza con "<course_id>/...", así que el
-- primer segmento de la ruta nos dice a qué curso pertenece.
drop policy if exists "report photos insert" on storage.objects;
create policy "report photos insert" on storage.objects for insert
  with check (
    bucket_id = 'report-photos'
    and owns_course(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "report photos read" on storage.objects;
create policy "report photos read" on storage.objects for select
  using (
    bucket_id = 'report-photos'
    and (owns_course(((storage.foldername(name))[1])::uuid) or can_view_reports())
  );

drop policy if exists "report photos delete" on storage.objects;
create policy "report photos delete" on storage.objects for delete
  using (
    bucket_id = 'report-photos'
    and owns_course(((storage.foldername(name))[1])::uuid)
  );

create table if not exists periodic_reports (
  id                uuid primary key default gen_random_uuid(),
  course_id         uuid not null references courses(id) on delete cascade,
  tutor_id          uuid not null references profiles(id) on delete cascade,
  tutor_name        text,
  report_date       date not null default current_date,
  place             text not null default 'Bienestar Social Universitario',
  group_label       text,
  participants_count int,
  program_name      text,
  subject_name      text,
  semester          text,
  professor_name    text,
  topics            text,
  description       text not null,
  observations      text,
  photo_path        text,
  created_at        timestamptz not null default now()
);
create index if not exists idx_preports_course on periodic_reports(course_id, report_date desc);

alter table periodic_reports enable row level security;

drop policy if exists "preports write" on periodic_reports;
create policy "preports write" on periodic_reports for all
  using (owns_course(course_id)) with check (owns_course(course_id));

drop policy if exists "preports read" on periodic_reports;
create policy "preports read" on periodic_reports for select
  using (owns_course(course_id) or can_view_reports());
