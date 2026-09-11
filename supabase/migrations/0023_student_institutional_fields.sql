-- ============================================================
-- 0023 — Datos institucionales del estudiante + roster para reportes
-- Agrega los campos que piden los formatos de Bienestar y que hoy no
-- se guardan en ningún lado (cédula, código estudiantil, sexo, grupo
-- priorizado). El propio estudiante los llena en su Perfil. También
-- agrega course_roster(), que arma en un solo viaje la lista de
-- estudiantes de un curso con todo lo necesario para el Excel de
-- asistencia y el de seguimiento. Aditivo. Idempotente.
-- ============================================================

alter table profiles add column if not exists national_id   text;
alter table profiles add column if not exists student_code  text;
alter table profiles add column if not exists sex           text;   -- 'F' | 'M'
alter table profiles add column if not exists priority_group text;  -- 'indigena' | 'afro' | 'discapacidad' | 'victima' | 'lgbtiq' | 'frontera' | null

create or replace function course_roster(p_course uuid)
returns table(
  student_id uuid, full_name text, email text,
  national_id text, student_code text, sex text, priority_group text,
  program_name text, subject_name text
) language plpgsql security definer set search_path = public as $$
begin
  if not (owns_course(p_course) or can_view_reports()) then
    raise exception 'No autorizado';
  end if;
  return query
    select p.id, p.full_name, p.email,
      p.national_id, p.student_code, p.sex, p.priority_group,
      (select ca.name from courses c
         join subjects su on su.id = c.subject_id
         join careers ca on ca.id = su.career_id
        where c.id = p_course),
      (select su.name from courses c
         join subjects su on su.id = c.subject_id
        where c.id = p_course)
    from enrollments e
    join profiles p on p.id = e.student_id
    where e.course_id = p_course and p.deleted_at is null
    order by p.full_name nulls last;
end; $$;

revoke execute on function course_roster(uuid) from anon, public;
grant  execute on function course_roster(uuid) to authenticated;

-- ---------- Datos institucionales de una lista puntual de estudiantes ----------
-- Para armar el reporte de asistencia "ocasional": esos estudiantes no
-- siempre están inscritos formalmente en el grupo, así que no sirve
-- course_roster (que solo trae inscritos).
create or replace function students_info(p_ids uuid[])
returns table(
  student_id uuid, full_name text, email text,
  national_id text, student_code text, sex text, priority_group text
) language plpgsql security definer set search_path = public as $$
begin
  if not (is_teacher(auth.uid()) or can_view_reports()) then
    raise exception 'No autorizado';
  end if;
  return query
    select p.id, p.full_name, p.email,
      p.national_id, p.student_code, p.sex, p.priority_group
    from profiles p
    where p.id = any(p_ids) and p.deleted_at is null;
end; $$;

revoke execute on function students_info(uuid[]) from anon, public;
grant  execute on function students_info(uuid[]) to authenticated;
