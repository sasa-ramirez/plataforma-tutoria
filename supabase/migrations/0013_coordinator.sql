-- ============================================================
-- 0013 — Rol Coordinador(a) de Tutoría + reportes (Fase 1)
-- Ve TODO (resúmenes, grupos, estudiantes) vía funciones seguras.
-- Aditivo. Ejecutar DESPUÉS de 0001-0012. Idempotente.
-- ============================================================

-- Bandera de coordinador (como is_admin).
alter table profiles add column if not exists is_coordinator boolean not null default false;

-- Blindaje: nadie se auto-asigna coordinador (solo roles de servidor / SECURITY DEFINER).
create or replace function protect_profile_role()
returns trigger language plpgsql as $$
begin
  if (new.role is distinct from old.role
      or new.is_admin is distinct from old.is_admin
      or new.is_coordinator is distinct from old.is_coordinator)
     and current_user not in ('postgres','supabase_admin','service_role') then
    raise exception 'No puedes cambiar tu rol o privilegios.';
  end if;
  return new;
end; $$;

create or replace function is_coordinator(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from profiles where id = uid and is_coordinator = true);
$$;

-- El ADMIN nombra (o quita) coordinador por correo.
create or replace function set_coordinator(p_email text, p_value boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin(auth.uid()) then
    raise exception 'No autorizado: se requiere admin.';
  end if;
  update profiles set is_coordinator = p_value where email = lower(trim(p_email));
  if not found then raise exception 'No existe un usuario con ese correo.'; end if;
end; $$;

-- Quién puede ver reportes: coordinador o admin.
create or replace function can_view_reports()
returns boolean language sql stable security definer set search_path = public as $$
  select is_coordinator(auth.uid()) or is_admin(auth.uid());
$$;

-- ---------- Resumen general ----------
create or replace function coord_overview()
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not can_view_reports() then raise exception 'No autorizado'; end if;
  return jsonb_build_object(
    'students',    (select count(*) from profiles where role='student' and deleted_at is null),
    'teachers',    (select count(*) from profiles where role='teacher' and deleted_at is null),
    'courses',     (select count(*) from courses where deleted_at is null),
    'assignments', (select count(*) from assignments where deleted_at is null),
    'submissions', (select count(*) from submissions where status <> 'draft'),
    'avg_score',   (select coalesce(round(avg(score)),0) from submissions where status='graded' and score is not null)
  );
end; $$;

-- ---------- Reporte por GRUPO (curso) ----------
create or replace function coord_groups()
returns table(
  course_id uuid, title text, teacher_name text, subject_name text,
  students bigint, assignments bigint, submissions bigint, avg_score numeric
) language plpgsql security definer set search_path = public as $$
begin
  if not can_view_reports() then raise exception 'No autorizado'; end if;
  return query
    select c.id, c.title, tp.full_name, s.name,
      (select count(*) from enrollments e where e.course_id = c.id),
      (select count(*) from assignments a where a.course_id = c.id and a.deleted_at is null),
      (select count(*) from submissions sub
         join exercises ex on ex.id = sub.exercise_id
         join assignments a on a.id = ex.assignment_id
        where a.course_id = c.id and sub.status <> 'draft'),
      (select round(avg(sub.score)) from submissions sub
         join exercises ex on ex.id = sub.exercise_id
         join assignments a on a.id = ex.assignment_id
        where a.course_id = c.id and sub.status='graded' and sub.score is not null)
    from courses c
    left join profiles tp on tp.id = c.teacher_id
    left join subjects s on s.id = c.subject_id
    where c.deleted_at is null
    order by c.created_at desc;
end; $$;

-- Tareas de un grupo (para ver "qué se deja").
create or replace function coord_group_assignments(p_course uuid)
returns table(id uuid, title text, status text, difficulty text, closes_at timestamptz, exercises bigint)
language plpgsql security definer set search_path = public as $$
begin
  if not can_view_reports() then raise exception 'No autorizado'; end if;
  return query
    select a.id, a.title, a.status::text, a.difficulty::text, a.closes_at,
      (select count(*) from exercises ex where ex.assignment_id = a.id and ex.deleted_at is null)
    from assignments a
    where a.course_id = p_course and a.deleted_at is null
    order by a.created_at desc;
end; $$;

-- ---------- Reporte por ESTUDIANTE ----------
create or replace function coord_students()
returns table(
  student_id uuid, full_name text, email text,
  courses bigint, submissions bigint, avg_score numeric,
  xp int, streak int, last_active date
) language plpgsql security definer set search_path = public as $$
begin
  if not can_view_reports() then raise exception 'No autorizado'; end if;
  return query
    select p.id, p.full_name, p.email,
      (select count(*) from enrollments e where e.student_id = p.id),
      (select count(*) from submissions sub where sub.student_id = p.id and sub.status <> 'draft'),
      (select round(avg(sub.score)) from submissions sub where sub.student_id = p.id and sub.status='graded' and sub.score is not null),
      p.xp, p.streak, p.last_active
    from profiles p
    where p.role='student' and p.deleted_at is null
    order by p.full_name nulls last;
end; $$;

-- Entregas de un estudiante (reporte individual).
create or replace function coord_student_submissions(p_student uuid)
returns table(
  course_title text, exercise_title text, type text,
  status text, score int, submitted_at timestamptz
) language plpgsql security definer set search_path = public as $$
begin
  if not can_view_reports() then raise exception 'No autorizado'; end if;
  return query
    select c.title, ex.title, ex.type, sub.status::text, sub.score, sub.submitted_at
    from submissions sub
    join exercises ex on ex.id = sub.exercise_id
    left join assignments a on a.id = ex.assignment_id
    left join courses c on c.id = a.course_id
    where sub.student_id = p_student and sub.status <> 'draft'
    order by sub.submitted_at desc nulls last
    limit 100;
end; $$;

revoke execute on function set_coordinator(text, boolean) from anon, public;
grant  execute on function set_coordinator(text, boolean) to authenticated;
