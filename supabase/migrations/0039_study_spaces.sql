-- ============================================================
-- 0039 — Módulo de estudio (parte 2): el estudiante sube PDFs /
-- PowerPoint de sus materias y Kodea los convierte en notas por tema.
--
-- Diseño (pensado para que sea barato y privado):
--   * El texto se extrae EN EL NAVEGADOR; el archivo original NO se guarda.
--   * La IA resume cada documento UNA vez en notas por tema; los quizzes y
--     parciales de las siguientes partes se arman con esas notas, no con
--     los documentos completos.
--   * Todo es PRIVADO del estudiante (RLS por student_id).
--   * Un presupuesto diario de caracteres por estudiante (study_usage) lo
--     aplica la Edge Function para acotar el costo.
--
-- Aditivo. Idempotente. Ejecutar DESPUÉS de 0038.
-- ============================================================

-- ---------- Espacios de estudio (una materia = un espacio) ----------
create table if not exists study_spaces (
  id         uuid primary key default gen_random_uuid(),
  student_id uuid not null references profiles(id) on delete cascade,
  title      text not null check (char_length(btrim(title)) between 1 and 120),
  created_at timestamptz not null default now()
);
create index if not exists idx_study_spaces_student on study_spaces(student_id, created_at desc);

-- ---------- Documentos subidos (solo metadatos; sin el archivo) ----------
create table if not exists study_documents (
  id         uuid primary key default gen_random_uuid(),
  space_id   uuid not null references study_spaces(id) on delete cascade,
  student_id uuid not null references profiles(id) on delete cascade,
  file_name  text not null,
  kind       text not null check (kind in ('pdf', 'pptx')),
  page_count int  not null default 0,   -- páginas (PDF) o diapositivas (PPTX)
  char_count int  not null default 0,   -- texto extraído que se envió a resumir
  truncated  boolean not null default false, -- true si se recortó por ser muy largo
  status     text not null default 'processing' check (status in ('processing', 'ready', 'error')),
  error      text,
  created_at timestamptz not null default now()
);
create index if not exists idx_study_docs_space on study_documents(space_id, created_at);

-- ---------- Notas por tema (lo que produce la IA) ----------
create table if not exists study_notes (
  id          uuid primary key default gen_random_uuid(),
  document_id uuid not null references study_documents(id) on delete cascade,
  space_id    uuid not null references study_spaces(id) on delete cascade,
  student_id  uuid not null references profiles(id) on delete cascade,
  topic       text not null,
  summary     text not null,
  key_points  jsonb not null default '[]'::jsonb,
  position    int  not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists idx_study_notes_space on study_notes(space_id, position);
create index if not exists idx_study_notes_doc on study_notes(document_id);

-- ---------- Presupuesto de IA por estudiante (lo usa la Edge Function) ----------
create table if not exists study_usage (
  id         uuid primary key default gen_random_uuid(),
  student_id uuid not null references profiles(id) on delete cascade,
  chars      int  not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_study_usage_student_time on study_usage(student_id, created_at);

-- ---------- Topes (evitan abuso de almacenamiento) ----------
create or replace function study_enforce_limits()
returns trigger language plpgsql as $$
begin
  if tg_table_name = 'study_spaces' then
    if (select count(*) from study_spaces where student_id = new.student_id) >= 20 then
      raise exception 'Llegaste al máximo de 20 materias de estudio. Borra alguna para crear otra.';
    end if;
  elsif tg_table_name = 'study_documents' then
    if (select count(*) from study_documents where space_id = new.space_id) >= 15 then
      raise exception 'Cada materia admite hasta 15 documentos.';
    end if;
  elsif tg_table_name = 'study_notes' then
    if (select count(*) from study_notes where document_id = new.document_id) >= 80 then
      raise exception 'Este documento ya tiene demasiadas notas.';
    end if;
  end if;
  return new;
end; $$;

drop trigger if exists trg_study_spaces_limit on study_spaces;
create trigger trg_study_spaces_limit before insert on study_spaces
  for each row execute function study_enforce_limits();
drop trigger if exists trg_study_docs_limit on study_documents;
create trigger trg_study_docs_limit before insert on study_documents
  for each row execute function study_enforce_limits();
drop trigger if exists trg_study_notes_limit on study_notes;
create trigger trg_study_notes_limit before insert on study_notes
  for each row execute function study_enforce_limits();

-- ---------- RLS: todo es del estudiante dueño, y de nadie más ----------
alter table study_spaces    enable row level security;
alter table study_documents enable row level security;
alter table study_notes     enable row level security;
alter table study_usage     enable row level security;  -- sin políticas: solo service-role

drop policy if exists "study spaces own" on study_spaces;
create policy "study spaces own" on study_spaces for all
  using (student_id = auth.uid())
  with check (student_id = auth.uid());

drop policy if exists "study docs own" on study_documents;
create policy "study docs own" on study_documents for all
  using (student_id = auth.uid())
  with check (
    student_id = auth.uid()
    and exists (select 1 from study_spaces s where s.id = space_id and s.student_id = auth.uid())
  );

drop policy if exists "study notes own" on study_notes;
create policy "study notes own" on study_notes for all
  using (student_id = auth.uid())
  with check (
    student_id = auth.uid()
    and exists (
      select 1 from study_documents d
       where d.id = document_id and d.student_id = auth.uid() and d.space_id = study_notes.space_id
    )
  );
