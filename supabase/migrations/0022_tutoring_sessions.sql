-- ============================================================
-- 0022 — Asistencia de tutorías + docente de la asignatura
-- Registra sesiones de tutoría presencial (planificada u ocasional)
-- con quién asistió, para poder generar el reporte oficial de
-- asistencia sin llenarlo a mano. También guarda el nombre del
-- docente titular de la asignatura (distinto del tutor), que piden
-- los formatos de Bienestar (BS-F-17, AD-F-01).
-- Aditivo. Ejecutar DESPUÉS de 0001-0021. Idempotente.
-- ============================================================

alter table courses add column if not exists professor_name text;

do $$ begin
  create type tutoring_session_type as enum ('planificada', 'ocasional');
exception when duplicate_object then null; end $$;

create table if not exists tutoring_sessions (
  id           uuid primary key default gen_random_uuid(),
  course_id    uuid not null references courses(id) on delete cascade,
  tutor_id     uuid not null references profiles(id) on delete cascade,
  session_date date not null default current_date,
  type         tutoring_session_type not null default 'planificada',
  topic        text,
  created_at   timestamptz not null default now()
);
create index if not exists idx_tsess_course on tutoring_sessions(course_id, session_date desc);

create table if not exists tutoring_attendance (
  id         uuid primary key default gen_random_uuid(),
  session_id uuid not null references tutoring_sessions(id) on delete cascade,
  student_id uuid not null references profiles(id) on delete cascade,
  present    boolean not null default true,
  unique (session_id, student_id)
);
create index if not exists idx_tattend_session on tutoring_attendance(session_id);
create index if not exists idx_tattend_student on tutoring_attendance(student_id);

alter table tutoring_sessions   enable row level security;
alter table tutoring_attendance enable row level security;

-- ---------- RLS: sesiones ----------
-- El tutor dueño del curso gestiona todo (crear/editar/borrar).
drop policy if exists "tsess write" on tutoring_sessions;
create policy "tsess write" on tutoring_sessions for all
  using (owns_course(course_id)) with check (owns_course(course_id));
-- Lectura más amplia: tutor, coordinación y los inscritos en el curso.
drop policy if exists "tsess read" on tutoring_sessions;
create policy "tsess read" on tutoring_sessions for select
  using (owns_course(course_id) or can_view_reports() or is_enrolled(course_id));

-- ---------- RLS: asistencia ----------
drop policy if exists "tattend write" on tutoring_attendance;
create policy "tattend write" on tutoring_attendance for all
  using (exists (
    select 1 from tutoring_sessions s
    where s.id = session_id and owns_course(s.course_id)
  ))
  with check (exists (
    select 1 from tutoring_sessions s
    where s.id = session_id and owns_course(s.course_id)
  ));
-- El propio estudiante puede ver su fila; tutor y coordinación ven todas.
drop policy if exists "tattend read" on tutoring_attendance;
create policy "tattend read" on tutoring_attendance for select
  using (
    student_id = auth.uid()
    or exists (
      select 1 from tutoring_sessions s
      where s.id = session_id and (owns_course(s.course_id) or can_view_reports())
    )
  );

-- ---------- Búsqueda de estudiantes (para agregar a una tutoría ocasional) ----------
-- Solo tutores/coordinación; no expone estudiantes a otros estudiantes.
create or replace function search_students(p_query text)
returns table(id uuid, full_name text, email text)
language plpgsql security definer set search_path = public as $$
begin
  if not (is_teacher(auth.uid()) or can_view_reports()) then
    raise exception 'No autorizado';
  end if;
  return query
    select p.id, p.full_name, p.email
    from profiles p
    where p.role = 'student' and p.deleted_at is null
      and (
        p.full_name ilike '%'||p_query||'%'
        or p.email ilike '%'||p_query||'%'
      )
    order by p.full_name nulls last
    limit 10;
end; $$;

revoke execute on function search_students(text) from anon, public;
grant  execute on function search_students(text) to authenticated;
