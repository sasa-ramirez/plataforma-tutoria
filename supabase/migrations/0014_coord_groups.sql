-- ============================================================
-- 0014 — Coordinación Fase 2: crear grupos, asignar tutor, inscribir y avisar
-- La coordinadora crea grupos (con horario y tutor) e inscribe estudiantes;
-- el sistema les notifica su grupo/tutor/horario. Aditivo. Idempotente.
-- ============================================================

-- Horario del grupo (texto libre: "Lun/Mié 2–4pm, Aula 301").
alter table courses add column if not exists schedule text;

-- Reporte por grupo ahora incluye horario y código de unión.
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

-- ---------- Crear grupo + asignar tutor (lo promueve a profesor) ----------
create or replace function coord_create_group(
  p_title text,
  p_subject_id uuid,
  p_tutor_email text,
  p_schedule text
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  tutor_id uuid;
  cid uuid;
  jcode text;
begin
  if not can_view_reports() then raise exception 'No autorizado'; end if;
  if coalesce(trim(p_title),'') = '' then raise exception 'El grupo necesita un título.'; end if;

  select id into tutor_id
    from profiles where email = lower(trim(p_tutor_email)) and deleted_at is null;
  if tutor_id is null then
    raise exception 'El tutor no tiene cuenta. Pídele que se registre primero.';
  end if;

  -- Cualquier cuenta designada como tutor se promueve a profesor.
  update profiles set role = 'teacher' where id = tutor_id and role <> 'teacher';

  insert into courses (teacher_id, title, subject_id, schedule)
  values (tutor_id, trim(p_title), p_subject_id, nullif(trim(p_schedule), ''))
  returning id, join_code into cid, jcode;

  -- Avisar al tutor.
  insert into notifications(user_id, type, title, body, link)
  values (tutor_id, 'group_tutor', 'Eres tutor de un grupo 👨‍🏫',
          'Grupo: ' || trim(p_title)
            || coalesce(' · Horario: ' || nullif(trim(p_schedule),''), ''),
          '/app/courses/' || cid);

  return jsonb_build_object('course_id', cid, 'join_code', jcode);
end; $$;

-- ---------- Inscribir estudiantes por correo + avisarles ----------
create or replace function coord_add_students(p_course uuid, p_emails text[])
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  e text;
  sid uuid;
  added int := 0;
  missing text[] := '{}';
  ctitle text;
  sched text;
  tname text;
begin
  if not can_view_reports() then raise exception 'No autorizado'; end if;

  select c.title, c.schedule, tp.full_name
    into ctitle, sched, tname
    from courses c
    left join profiles tp on tp.id = c.teacher_id
   where c.id = p_course;
  if ctitle is null then raise exception 'Grupo no encontrado'; end if;

  foreach e in array p_emails loop
    if coalesce(trim(e),'') = '' then continue; end if;
    select id into sid from profiles
      where email = lower(trim(e)) and deleted_at is null;
    if sid is null then
      missing := array_append(missing, trim(e));
      continue;
    end if;

    insert into enrollments(course_id, student_id)
    values (p_course, sid)
    on conflict (course_id, student_id) do nothing;

    insert into notifications(user_id, type, title, body, link)
    values (sid, 'group_assigned', 'Te asignaron a un grupo de tutoría 📚',
            'Grupo: ' || ctitle
              || coalesce(' · Tutor: ' || tname, '')
              || coalesce(' · Horario: ' || sched, ''),
            '/app/courses/' || p_course);
    added := added + 1;
  end loop;

  return jsonb_build_object('added', added, 'missing', missing);
end; $$;

revoke execute on function coord_create_group(text, uuid, text, text) from anon, public;
grant  execute on function coord_create_group(text, uuid, text, text) to authenticated;
revoke execute on function coord_add_students(uuid, text[]) from anon, public;
grant  execute on function coord_add_students(uuid, text[]) to authenticated;
