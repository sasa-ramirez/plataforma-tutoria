-- ============================================================
-- 0041 — Quiz "Tarea abierta": se deja abierto y cada estudiante lo
-- hace cuando quiera (ahora o en la noche), a su ritmo y con UN solo
-- intento. Arranca de inmediato (sin sala de espera ni botón Comenzar)
-- y puede cerrarse solo a una fecha y hora.
--
-- No cambia los modos que ya existen ('sync' / 'pace' con sala de
-- espera): es una opción más al iniciar el quiz.
--
-- Aditivo. Idempotente. Ejecutar DESPUÉS de 0040.
-- ============================================================

alter table quiz_sessions add column if not exists is_open   boolean not null default false;
alter table quiz_sessions add column if not exists closes_at timestamptz;

-- ---------- Iniciar: ahora acepta "tarea abierta" y hora de cierre ----------
drop function if exists quiz_start_session(uuid, text, boolean);

create or replace function quiz_start_session(
  p_assignment uuid,
  p_mode       text,
  p_shuffle    boolean default false,
  p_open       boolean default false,
  p_closes_at  timestamptz default null
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_course uuid;
  v_count  int;
  v_id     uuid;
  v_mode   text := p_mode;
begin
  -- La tarea abierta siempre es "a su ritmo".
  if p_open then v_mode := 'pace'; end if;
  if v_mode not in ('sync', 'pace') then
    raise exception 'Modo no válido.';
  end if;
  if p_open and p_closes_at is not null and p_closes_at <= now() then
    raise exception 'La hora de cierre tiene que ser en el futuro.';
  end if;

  select a.course_id into v_course from assignments a where a.id = p_assignment;
  if v_course is null then raise exception 'Tarea no encontrada.'; end if;
  if not owns_course(v_course) then raise exception 'No autorizado.'; end if;

  -- Una tarea abierta que ya pasó su hora de cierre deja de contar como "abierta"
  -- (si no, bloquearía crear el siguiente quiz hasta que alguien la terminara a mano).
  update quiz_sessions
     set status = 'ended', ended_at = closes_at
   where assignment_id = p_assignment
     and status <> 'ended'
     and closes_at is not null
     and closes_at <= now();

  select id into v_id from quiz_sessions
   where assignment_id = p_assignment and status <> 'ended'
   order by created_at desc limit 1;
  if v_id is not null then return v_id; end if;

  select count(*) into v_count
    from exercises e
   where e.assignment_id = p_assignment
     and e.type = 'multiple_choice'
     and e.deleted_at is null;
  if v_count = 0 then
    raise exception 'Esta tarea no tiene preguntas de opción múltiple.';
  end if;

  begin
    insert into quiz_sessions
      (assignment_id, course_id, mode, shuffle, created_by, is_open, closes_at, status, started_at)
    values
      (p_assignment, v_course, v_mode, coalesce(p_shuffle, false), auth.uid(),
       coalesce(p_open, false),
       case when p_open then p_closes_at end,
       case when p_open then 'active' else 'lobby' end,
       case when p_open then now() end)
    returning id into v_id;
  exception when unique_violation then
    select id into v_id from quiz_sessions
     where assignment_id = p_assignment and status <> 'ended'
     order by created_at desc limit 1;
  end;

  return v_id;
end; $$;

-- ---------- quiz_join: no se puede entrar por primera vez después del cierre ----------
create or replace function quiz_join(p_session uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_course     uuid;
  v_status     text;
  v_assignment uuid;
  v_shuffle    boolean;
  v_closes     timestamptz;
  v_order      uuid[];
  v_id         uuid;
  v_seen       timestamptz;
begin
  select course_id, status, assignment_id, shuffle, closes_at
    into v_course, v_status, v_assignment, v_shuffle, v_closes
    from quiz_sessions where id = p_session;
  if v_course is null then raise exception 'Sesión no encontrada.'; end if;

  select id into v_id from quiz_participants
   where session_id = p_session and student_id = auth.uid();

  if v_id is not null then
    -- Volvió (también después del cierre, para ver su resultado).
    select last_seen_at into v_seen from quiz_presence where participant_id = v_id;
    if v_seen is not null and now() - v_seen > interval '60 seconds' then
      insert into quiz_events (session_id, student_id, kind, detail)
      values (p_session, auth.uid(), 'rejoin',
              jsonb_build_object('gap_seconds', extract(epoch from (now() - v_seen))::int));
    elsif v_seen is null then
      insert into quiz_events (session_id, student_id, kind) values (p_session, auth.uid(), 'rejoin');
    end if;
    insert into quiz_presence (participant_id, session_id, last_seen_at)
    values (v_id, p_session, now())
    on conflict (participant_id) do update set last_seen_at = now();
    return v_id;
  end if;

  if v_status = 'ended' then raise exception 'Este quiz ya terminó.'; end if;
  if v_closes is not null and v_closes <= now() then raise exception 'Este quiz ya cerró.'; end if;
  if not (is_enrolled(v_course) or owns_course(v_course)) then
    raise exception 'No autorizado.';
  end if;

  if v_shuffle then
    select array_agg(id order by random()) into v_order
      from exercises
     where assignment_id = v_assignment
       and type = 'multiple_choice'
       and deleted_at is null;
  end if;

  insert into quiz_participants (session_id, student_id, question_order)
  values (p_session, auth.uid(), v_order)
  on conflict (session_id, student_id) do nothing;

  select id into v_id from quiz_participants
   where session_id = p_session and student_id = auth.uid();

  insert into quiz_presence (participant_id, session_id, last_seen_at)
  values (v_id, p_session, now())
  on conflict (participant_id) do update set last_seen_at = now();
  insert into quiz_events (session_id, student_id, kind)
  values (p_session, auth.uid(), 'join');

  return v_id;
end; $$;

-- ---------- quiz_submit_answer: no se responde después del cierre ----------
create or replace function quiz_submit_answer(p_session uuid, p_exercise uuid, p_selected int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  s       quiz_sessions;
  part    quiz_participants;
  v_order uuid[];
  v_idx   int;
  v_key   jsonb;
  is_ok   boolean;
  pts     int;
begin
  select * into s from quiz_sessions where id = p_session;
  if s.id is null then raise exception 'Sesión no encontrada.'; end if;
  if s.status <> 'active' then raise exception 'El quiz no está activo ahora mismo.'; end if;
  if s.closes_at is not null and s.closes_at <= now() then
    raise exception 'Este quiz ya cerró.';
  end if;

  select * into part from quiz_participants
   where session_id = p_session and student_id = auth.uid();
  if part.id is null then raise exception 'Primero debes unirte al quiz.'; end if;

  if s.shuffle and part.question_order is not null then
    v_order := part.question_order;
  else
    select array_agg(e.id order by e.order_index, e.created_at) into v_order
      from exercises e
     where e.assignment_id = s.assignment_id
       and e.type = 'multiple_choice'
       and e.deleted_at is null;
  end if;

  v_idx := array_position(v_order, p_exercise) - 1;
  if v_idx is null then
    raise exception 'Pregunta no válida para este quiz.';
  end if;

  select key into v_key from exercise_answers where exercise_id = p_exercise;

  if s.mode = 'sync' and v_idx <> s.current_index then
    raise exception 'Esa no es la pregunta activa ahora mismo.';
  end if;
  if s.mode = 'pace' and v_idx <> part.current_index then
    raise exception 'Responde las preguntas en orden.';
  end if;

  is_ok := (v_key->>'correct') = p_selected::text;
  pts := case when is_ok then 100 else 0 end;

  begin
    insert into quiz_answers (session_id, participant_id, exercise_id, selected, correct)
    values (p_session, part.id, p_exercise, p_selected, is_ok);
  exception when unique_violation then
    raise exception 'Ya respondiste esta pregunta.';
  end;

  update quiz_participants
     set score = score + pts,
         current_index = greatest(current_index, v_idx + 1)
   where id = part.id;

  return jsonb_build_object('correct', is_ok, 'points', pts);
end; $$;

-- ---------- Informe: ahora trae la hora de cierre, el modo y la primera respuesta ----------
create or replace function quiz_report(p_assignment uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_course uuid;
  v_title  text;
  v_course_name text;
begin
  select a.course_id, a.title into v_course, v_title from assignments a where a.id = p_assignment;
  if v_course is null then raise exception 'Tarea no encontrada.'; end if;
  if not owns_course(v_course) then raise exception 'No autorizado.'; end if;

  select c.title into v_course_name from courses c where c.id = v_course;

  return jsonb_build_object(
    'assignment', jsonb_build_object('id', p_assignment, 'title', v_title, 'course_name', v_course_name),
    'questions', coalesce((
      select jsonb_agg(jsonb_build_object('id', e.id, 'title', e.title) order by e.order_index, e.created_at)
        from exercises e
       where e.assignment_id = p_assignment and e.type = 'multiple_choice' and e.deleted_at is null
    ), '[]'::jsonb),
    'roster', coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'full_name', p.full_name, 'email', p.email)
                       order by p.full_name)
        from enrollments en join profiles p on p.id = en.student_id
       where en.course_id = v_course
    ), '[]'::jsonb),
    'sessions', coalesce((
      select jsonb_agg(sj order by sj->>'created_at') from (
        select jsonb_build_object(
          'id', s.id, 'mode', s.mode, 'shuffle', s.shuffle, 'status', s.status,
          'is_open', s.is_open, 'closes_at', s.closes_at,
          'created_at', s.created_at, 'started_at', s.started_at, 'ended_at', s.ended_at,
          'notes', s.notes,
          'participants', coalesce((
            select jsonb_agg(jsonb_build_object(
              'student_id', qp.student_id,
              'score', qp.score,
              'answered', (select count(*) from quiz_answers qa where qa.participant_id = qp.id),
              'correct',  (select count(*) from quiz_answers qa where qa.participant_id = qp.id and qa.correct),
              'joined_at', qp.joined_at,
              'last_seen_at', (select pr.last_seen_at from quiz_presence pr where pr.participant_id = qp.id),
              'first_answer_at', (select min(qa.answered_at) from quiz_answers qa where qa.participant_id = qp.id),
              'last_answer_at', (select max(qa.answered_at) from quiz_answers qa where qa.participant_id = qp.id)
            ))
            from quiz_participants qp
           where qp.session_id = s.id
             and exists (select 1 from enrollments en where en.course_id = s.course_id and en.student_id = qp.student_id)
          ), '[]'::jsonb),
          'per_question', coalesce((
            select jsonb_agg(jsonb_build_object('exercise_id', x.exercise_id, 'total', x.total, 'correct', x.correct))
              from (
                select qa.exercise_id, count(*) as total, count(*) filter (where qa.correct) as correct
                  from quiz_answers qa
                  join quiz_participants qp on qp.id = qa.participant_id
                 where qa.session_id = s.id
                   and exists (select 1 from enrollments en where en.course_id = s.course_id and en.student_id = qp.student_id)
                 group by qa.exercise_id
              ) x
          ), '[]'::jsonb),
          'events', coalesce((
            select jsonb_agg(jsonb_build_object('student_id', ev.student_id, 'kind', ev.kind,
                                                'detail', ev.detail, 'at', ev.created_at)
                             order by ev.created_at)
              from quiz_events ev where ev.session_id = s.id
          ), '[]'::jsonb)
        ) as sj
        from quiz_sessions s
       where s.assignment_id = p_assignment
      ) t
    ), '[]'::jsonb)
  );
end; $$;

revoke execute on function quiz_start_session(uuid, text, boolean, boolean, timestamptz) from anon, public;
revoke execute on function quiz_join(uuid)                         from anon, public;
revoke execute on function quiz_submit_answer(uuid, uuid, int)     from anon, public;
revoke execute on function quiz_report(uuid)                       from anon, public;
grant  execute on function quiz_start_session(uuid, text, boolean, boolean, timestamptz) to authenticated;
grant  execute on function quiz_join(uuid)                         to authenticated;
grant  execute on function quiz_submit_answer(uuid, uuid, int)     to authenticated;
grant  execute on function quiz_report(uuid)                       to authenticated;
