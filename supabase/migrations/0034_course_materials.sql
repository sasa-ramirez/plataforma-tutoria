-- ============================================================
-- 0034 — Materiales educativos por curso
-- El tutor sube documentos (PDF, Word, PowerPoint) o enlaces para que sus
-- estudiantes estudien. Bucket privado: solo el tutor dueño del curso puede
-- subir/borrar; el tutor y los inscritos pueden ver y descargar.
-- Aditivo. Idempotente.
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'course-materials', 'course-materials', false, 26214400,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ]
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- El path de cada archivo empieza con "<course_id>/...", así que el primer
-- segmento de la ruta nos dice a qué curso pertenece (mismo patrón que
-- report-photos, migración 0024).
drop policy if exists "materials insert" on storage.objects;
create policy "materials insert" on storage.objects for insert
  with check (
    bucket_id = 'course-materials'
    and owns_course(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "materials read" on storage.objects;
create policy "materials read" on storage.objects for select
  using (
    bucket_id = 'course-materials'
    and (owns_course(((storage.foldername(name))[1])::uuid)
         or is_enrolled(((storage.foldername(name))[1])::uuid))
  );

drop policy if exists "materials delete" on storage.objects;
create policy "materials delete" on storage.objects for delete
  using (
    bucket_id = 'course-materials'
    and owns_course(((storage.foldername(name))[1])::uuid)
  );

create table if not exists course_materials (
  id           uuid primary key default gen_random_uuid(),
  course_id    uuid not null references courses(id) on delete cascade,
  title        text not null,
  description  text,
  kind         text not null check (kind in ('file', 'link')),
  storage_path text,  -- solo si kind = 'file'
  file_name    text,  -- nombre original, para mostrarlo
  mime_type    text,
  size_bytes   bigint,
  url          text,  -- solo si kind = 'link'
  created_by   uuid references profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  check (
    (kind = 'file' and storage_path is not null and url is null)
    or (kind = 'link' and url is not null and storage_path is null)
  )
);
create index if not exists idx_materials_course on course_materials(course_id, created_at desc);

alter table course_materials enable row level security;

drop policy if exists "materials row write" on course_materials;
create policy "materials row write" on course_materials for all
  using (owns_course(course_id)) with check (owns_course(course_id));

drop policy if exists "materials row read" on course_materials;
create policy "materials row read" on course_materials for select
  using (owns_course(course_id) or is_enrolled(course_id));
