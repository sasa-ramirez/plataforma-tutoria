-- ============================================================
-- 0019 — Coordinación: nombre del curso/grupo en el reporte de estudiantes
-- coord_students() ahora también devuelve los nombres de los cursos en
-- los que está inscrito cada estudiante (para la columna "Curso" del
-- Excel exportado). Idempotente.
-- ============================================================

drop function if exists coord_students(text, int, int);

create or replace function coord_students(
  p_search text default null,
  p_limit  int  default 20,
  p_offset int  default 0
)
returns table(
  student_id uuid, full_name text, email text,
  courses bigint, course_names text, submissions bigint, avg_score numeric,
  xp int, streak int, last_active date, total_count bigint
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
      count(*) over() as total_count
    from profiles p
    where p.role='student' and p.deleted_at is null
      and (q is null or p.full_name ilike '%'||q||'%' or p.email ilike '%'||q||'%')
    order by p.full_name nulls last
    limit greatest(p_limit, 1) offset greatest(p_offset, 0);
end; $$;

revoke execute on function coord_students(text, int, int) from anon, public;
grant  execute on function coord_students(text, int, int) to authenticated;
