-- ============================================================
-- 0020 — Registro de ingresos + panel de tutores para Coordinación
-- Guarda cada inicio de sesión (login_events) y lo suma a los reportes
-- de estudiantes y de tutores, con una pestaña nueva "Tutores" (mismo
-- patrón que Estudiantes: buscar, paginar, ver detalle). Idempotente.
-- ============================================================

-- ---------- Registro de inicios de sesión ----------
create table if not exists login_events (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists idx_login_events_user on login_events(user_id, created_at desc);

alter table login_events enable row level security;
drop policy if exists "login insert own" on login_events;
create policy "login insert own" on login_events for insert
  with check (user_id = auth.uid());
-- Sin política de select: nadie lee la tabla directo, solo vía las
-- funciones de coordinación (SECURITY DEFINER) de abajo.

-- ---------- Estudiantes: se suma cuántas veces entró y su último ingreso ----------
drop function if exists coord_students(text, int, int);

create or replace function coord_students(
  p_search text default null,
  p_limit  int  default 20,
  p_offset int  default 0
)
returns table(
  student_id uuid, full_name text, email text,
  courses bigint, course_names text, submissions bigint, avg_score numeric,
  xp int, streak int, last_active date,
  login_count bigint, last_login timestamptz, total_count bigint
) language plpgsql security definer set search_path = public as $$
declare
  q text := nullif(trim(p_search), '');
begin
  if not can_view_reports() then raise exception 'No autorizado'; end if;
  return query
    select p.id, p.full_name, p.email,
      (select count(*) from enrollments e where e.student_id = p.id),
      (select string_agg(c.title, ', ' order by c.title)
         from enrollments e
         join courses c on c.id = e.course_id and c.deleted_at is null
        where e.student_id = p.id),
      (select count(*) from submissions sub where sub.student_id = p.id and sub.status <> 'draft'),
      (select round(avg(sub.score)) from submissions sub where sub.student_id = p.id and sub.status='graded' and sub.score is not null),
      p.xp, p.streak, p.last_active,
      (select count(*) from login_events le where le.user_id = p.id),
      (select max(le.created_at) from login_events le where le.user_id = p.id),
      count(*) over() as total_count
    from profiles p
    where p.role='student' and p.deleted_at is null
      and (q is null or p.full_name ilike '%'||q||'%' or p.email ilike '%'||q||'%')
    order by p.full_name nulls last
    limit greatest(p_limit, 1) offset greatest(p_offset, 0);
end; $$;

revoke execute on function coord_students(text, int, int) from anon, public;
grant  execute on function coord_students(text, int, int) to authenticated;

-- ---------- Tutores: listado con búsqueda y paginación ----------
create or replace function coord_teachers(
  p_search text default null,
  p_limit  int  default 20,
  p_offset int  default 0
)
returns table(
  teacher_id uuid, full_name text, email text,
  groups bigint, students bigint, submissions bigint, avg_score numeric,
  login_count bigint, last_login timestamptz, total_count bigint
) language plpgsql security definer set search_path = public as $$
declare
  q text := nullif(trim(p_search), '');
begin
  if not can_view_reports() then raise exception 'No autorizado'; end if;
  return query
    select p.id, p.full_name, p.email,
      (select count(*) from courses c where c.teacher_id = p.id and c.deleted_at is null),
      (select count(distinct e.student_id)
         from enrollments e join courses c on c.id = e.course_id
        where c.teacher_id = p.id and c.deleted_at is null),
      (select count(*) from submissions sub
         join exercises ex on ex.id = sub.exercise_id
         join assignments a on a.id = ex.assignment_id
         join courses c on c.id = a.course_id
        where c.teacher_id = p.id and sub.status <> 'draft'),
      (select round(avg(sub.score)) from submissions sub
         join exercises ex on ex.id = sub.exercise_id
         join assignments a on a.id = ex.assignment_id
         join courses c on c.id = a.course_id
        where c.teacher_id = p.id and sub.status='graded' and sub.score is not null),
      (select count(*) from login_events le where le.user_id = p.id),
      (select max(le.created_at) from login_events le where le.user_id = p.id),
      count(*) over() as total_count
    from profiles p
    where p.role='teacher' and p.deleted_at is null
      and (q is null or p.full_name ilike '%'||q||'%' or p.email ilike '%'||q||'%')
    order by p.full_name nulls last
    limit greatest(p_limit, 1) offset greatest(p_offset, 0);
end; $$;

revoke execute on function coord_teachers(text, int, int) from anon, public;
grant  execute on function coord_teachers(text, int, int) to authenticated;

-- ---------- Grupos de un tutor (detalle al expandir) ----------
create or replace function coord_teacher_groups(p_teacher uuid)
returns table(
  course_id uuid, title text, subject_name text, schedule text,
  students bigint, assignments bigint, avg_score numeric
) language plpgsql security definer set search_path = public as $$
begin
  if not can_view_reports() then raise exception 'No autorizado'; end if;
  return query
    select c.id, c.title, s.name, c.schedule,
      (select count(*) from enrollments e where e.course_id = c.id),
      (select count(*) from assignments a where a.course_id = c.id and a.deleted_at is null),
      (select round(avg(sub.score)) from submissions sub
         join exercises ex on ex.id = sub.exercise_id
         join assignments a on a.id = ex.assignment_id
        where a.course_id = c.id and sub.status='graded' and sub.score is not null)
    from courses c
    left join subjects s on s.id = c.subject_id
    where c.teacher_id = p_teacher and c.deleted_at is null
    order by c.created_at desc;
end; $$;

revoke execute on function coord_teacher_groups(uuid) from anon, public;
grant  execute on function coord_teacher_groups(uuid) to authenticated;
