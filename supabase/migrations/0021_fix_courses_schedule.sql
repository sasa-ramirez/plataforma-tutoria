-- ============================================================
-- 0021 — Arregla la columna "schedule" de courses (faltaba)
-- coord_teacher_groups (0020) reveló que a la tabla courses le falta
-- la columna "schedule" que debia agregar la migracion 0014 (la
-- funcion se creo bien en su momento porque PL/pgSQL no valida el
-- cuerpo hasta que se ejecuta, asi que el error quedo escondido hasta
-- ahora). Se agrega la columna y se vuelve a dejar coord_groups() con
-- las columnas de horario/codigo que ya deberia tener. Idempotente.
-- ============================================================

alter table courses add column if not exists schedule text;

drop function if exists coord_groups();

create or replace function coord_groups()
returns table(
  course_id uuid, title text, teacher_name text, subject_name text,
  schedule text, join_code text,
  students bigint, assignments bigint, submissions bigint, avg_score numeric
) language plpgsql security definer set search_path = public as $$
begin
  if not can_view_reports() then raise exception 'No autorizado'; end if;
  return query
    select c.id, c.title, tp.full_name, s.name, c.schedule, c.join_code,
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

revoke execute on function coord_groups() from anon, public;
grant  execute on function coord_groups() to authenticated;
