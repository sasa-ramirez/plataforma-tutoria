-- ============================================================
-- 0017 — Coordinación: ver y quitar estudiantes de un grupo
-- Lista los estudiantes inscritos en un grupo (para poder quitarlos) y
-- agrega la función para desinscribirlos, con aviso. Aditivo. Idempotente.
-- ============================================================

-- ---------- Estudiantes inscritos en un grupo ----------
create or replace function coord_group_students(p_course uuid)
returns table(
  student_id uuid, full_name text, email text,
  submissions bigint, avg_score numeric, enrolled_at timestamptz
) language plpgsql security definer set search_path = public as $$
begin
  if not can_view_reports() then raise exception 'No autorizado'; end if;
  return query
    select p.id, p.full_name, p.email,
      (select count(*) from submissions sub
         join exercises ex on ex.id = sub.exercise_id
         join assignments a on a.id = ex.assignment_id
        where a.course_id = p_course and sub.student_id = p.id and sub.status <> 'draft'),
      (select round(avg(sub.score)) from submissions sub
         join exercises ex on ex.id = sub.exercise_id
         join assignments a on a.id = ex.assignment_id
        where a.course_id = p_course and sub.student_id = p.id
          and sub.status = 'graded' and sub.score is not null),
      e.created_at
    from enrollments e
    join profiles p on p.id = e.student_id
    where e.course_id = p_course and p.deleted_at is null
    order by p.full_name nulls last;
end; $$;

-- ---------- Quitar un estudiante de un grupo ----------
create or replace function coord_remove_student(p_course uuid, p_student uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  ctitle text;
begin
  if not can_view_reports() then raise exception 'No autorizado'; end if;

  select title into ctitle from courses where id = p_course;
  if ctitle is null then raise exception 'Grupo no encontrado'; end if;

  delete from enrollments where course_id = p_course and student_id = p_student;
  if not found then raise exception 'El estudiante no estaba en ese grupo.'; end if;

  insert into notifications(user_id, type, title, body, link)
  values (p_student, 'group_removed', 'Te quitaron de un grupo',
          'Ya no perteneces al grupo: ' || ctitle, '/app/courses');
end; $$;

revoke execute on function coord_group_students(uuid) from anon, public;
grant  execute on function coord_group_students(uuid) to authenticated;
revoke execute on function coord_remove_student(uuid, uuid) from anon, public;
grant  execute on function coord_remove_student(uuid, uuid) to authenticated;

-- ---------- Redefine sin emoji en el texto de las notificaciones ----------
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

  update profiles set role = 'teacher' where id = tutor_id and role <> 'teacher';

  insert into courses (teacher_id, title, subject_id, schedule)
  values (tutor_id, trim(p_title), p_subject_id, nullif(trim(p_schedule), ''))
  returning id, join_code into cid, jcode;

  insert into notifications(user_id, type, title, body, link)
  values (tutor_id, 'group_tutor', 'Eres tutor de un grupo',
          'Grupo: ' || trim(p_title)
            || coalesce(' · Horario: ' || nullif(trim(p_schedule),''), ''),
          '/app/courses/' || cid);

  return jsonb_build_object('course_id', cid, 'join_code', jcode);
end; $$;

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
    values (sid, 'group_assigned', 'Te asignaron a un grupo de tutoría',
            'Grupo: ' || ctitle
              || coalesce(' · Tutor: ' || tname, '')
              || coalesce(' · Horario: ' || sched, ''),
            '/app/courses/' || p_course);
    added := added + 1;
  end loop;

  return jsonb_build_object('added', added, 'missing', missing);
end; $$;
