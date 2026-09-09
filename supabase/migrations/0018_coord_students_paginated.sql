-- ============================================================
-- 0018 — Coordinación: estudiantes con búsqueda y paginación
-- coord_students() ya no trae a TODOS los estudiantes de una vez (no
-- escala con miles de usuarios): ahora acepta búsqueda por nombre/correo
-- y limit/offset, y devuelve el total junto con cada fila para poder
-- armar la paginación en el cliente. Idempotente.
-- ============================================================

-- Hay que borrarla porque cambia el tipo de retorno (agrega total_count);
-- CREATE OR REPLACE no permite eso.
drop function if exists coord_students();

create or replace function coord_students(
  p_search text default null,
  p_limit  int  default 20,
  p_offset int  default 0
)
returns table(
  student_id uuid, full_name text, email text,
  courses bigint, submissions bigint, avg_score numeric,
  xp int, streak int, last_active date, total_count bigint
) language plpgsql security definer set search_path = public as $$
declare
  q text := nullif(trim(p_search), '');
begin
  if not can_view_reports() then raise exception 'No autorizado'; end if;
  return query
    select p.id, p.full_name, p.email,
      (select count(*) from enrollments e where e.student_id = p.id),
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
