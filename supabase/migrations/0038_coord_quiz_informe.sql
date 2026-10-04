-- ============================================================
-- 0038 — Coordinación: informe de quizzes en vivo por grupo.
--
-- Hasta ahora solo el profesor dueño del curso podía leer los datos de
-- los quizzes (RLS con owns_course). El coordinador (o admin) los ve a
-- través de estas dos funciones de SOLO LECTURA, igual que el resto de
-- reportes de coordinación (can_view_reports()).
--
-- Aditivo. Idempotente. Ejecutar DESPUÉS de 0037.
-- ============================================================

-- Resumen por grupo: cuánto se usó el quiz en vivo y cómo les fue.
-- Solo cuentan estudiantes inscritos (se descartan las pruebas del tutor).
create or replace function coord_quiz_overview()
returns table(
  course_id     uuid,
  quiz_count    bigint,
  session_count bigint,
  student_count bigint,
  answer_count  bigint,
  correct_count bigint,
  last_quiz_at  timestamptz
) language plpgsql security definer set search_path = public as $$
begin
  if not can_view_reports() then raise exception 'No autorizado'; end if;
  return query
    select s.course_id,
           count(distinct s.assignment_id),
           count(distinct s.id),
           count(distinct qp.student_id),
           count(qa.id),
           count(qa.id) filter (where qa.correct),
           max(s.created_at)
      from quiz_answers qa
      join quiz_sessions s      on s.id  = qa.session_id
      join quiz_participants qp on qp.id = qa.participant_id
     where exists (
             select 1 from enrollments en
              where en.course_id = s.course_id and en.student_id = qp.student_id
           )
     group by s.course_id;
end; $$;

-- Todo lo necesario para el consolidado de UN grupo (misma forma que arma
-- el frontend para el profesor: sesiones, participantes, respuestas,
-- preguntas e inscritos).
create or replace function coord_group_quiz_data(p_course uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_title text;
begin
  if not can_view_reports() then raise exception 'No autorizado'; end if;

  select c.title into v_title from courses c where c.id = p_course;
  if v_title is null then raise exception 'Grupo no encontrado'; end if;

  return jsonb_build_object(
    'course_title', v_title,
    'sessions', coalesce((
      select jsonb_agg(jsonb_build_object('id', s.id, 'assignment_id', s.assignment_id))
        from quiz_sessions s where s.course_id = p_course
    ), '[]'::jsonb),
    'assignments', coalesce((
      select jsonb_agg(jsonb_build_object('id', a.id, 'title', a.title))
        from assignments a
       where a.id in (select s.assignment_id from quiz_sessions s where s.course_id = p_course)
    ), '[]'::jsonb),
    'participants', coalesce((
      select jsonb_agg(jsonb_build_object('id', qp.id, 'session_id', qp.session_id, 'student_id', qp.student_id))
        from quiz_participants qp
        join quiz_sessions s on s.id = qp.session_id
       where s.course_id = p_course
    ), '[]'::jsonb),
    'answers', coalesce((
      select jsonb_agg(jsonb_build_object('participant_id', qa.participant_id,
                                          'exercise_id', qa.exercise_id,
                                          'correct', qa.correct))
        from quiz_answers qa
        join quiz_sessions s on s.id = qa.session_id
       where s.course_id = p_course
    ), '[]'::jsonb),
    'exercises', coalesce((
      select jsonb_agg(jsonb_build_object('id', e.id, 'assignment_id', e.assignment_id,
                                          'title', e.title, 'topic', e.quiz_batch_topic,
                                          'deleted_at', e.deleted_at))
        from exercises e
       where e.type = 'multiple_choice'
         and e.assignment_id in (select s.assignment_id from quiz_sessions s where s.course_id = p_course)
    ), '[]'::jsonb),
    'roster', coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'full_name', p.full_name, 'email', p.email)
                       order by p.full_name)
        from enrollments en join profiles p on p.id = en.student_id
       where en.course_id = p_course
    ), '[]'::jsonb)
  );
end; $$;

revoke execute on function coord_quiz_overview()            from anon, public;
revoke execute on function coord_group_quiz_data(uuid)      from anon, public;
grant  execute on function coord_quiz_overview()            to authenticated;
grant  execute on function coord_group_quiz_data(uuid)      to authenticated;
