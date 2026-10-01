-- ============================================================
-- 0036 — Quiz en vivo: resultados (global + individual), orden
-- aleatorio de preguntas por estudiante (anti-copia), y lotes de
-- preguntas generadas por IA agrupables visualmente.
--
-- Aditivo. Idempotente. Ejecutar DESPUÉS de 0035_live_quiz.sql.
-- ============================================================

-- ---------- Shuffle de preguntas (por estudiante, opcional) ----------
alter table quiz_sessions add column if not exists shuffle boolean not null default false;
alter table quiz_participants add column if not exists question_order uuid[];

-- ---------- Lotes de preguntas generadas juntas por IA ----------
alter table exercises add column if not exists quiz_batch_id uuid;
alter table exercises add column if not exists quiz_batch_topic text;
create index if not exists idx_ex_quiz_batch on exercises(quiz_batch_id) where quiz_batch_id is not null;

-- ---------- quiz_start_session: ahora acepta "shuffle" ----------
-- Cambia la firma (nuevo parámetro) así que hay que soltar la versión
-- vieja antes de recrearla; el default en p_shuffle mantiene compatible
-- cualquier llamada que no lo mande.
drop function if exists quiz_start_session(uuid, text);

create or replace function quiz_start_session(p_assignment uuid, p_mode text, p_shuffle boolean default false)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_course uuid;
  v_count  int;
  v_id     uuid;
begin
  if p_mode not in ('sync', 'pace') then
    raise exception 'Modo no válido.';
  end if;

  select a.course_id into v_course from assignments a where a.id = p_assignment;
  if v_course is null then raise exception 'Tarea no encontrada.'; end if;
  if not owns_course(v_course) then raise exception 'No autorizado.'; end if;

  select count(*) into v_count
    from exercises e
   where e.assignment_id = p_assignment
     and e.type = 'multiple_choice'
     and e.deleted_at is null;
  if v_count = 0 then
    raise exception 'Esta tarea no tiene preguntas de opción múltiple.';
  end if;

  insert into quiz_sessions (assignment_id, course_id, mode, shuffle, created_by)
  values (p_assignment, v_course, p_mode, coalesce(p_shuffle, false), auth.uid())
  returning id into v_id;

  return v_id;
end; $$;

-- ---------- quiz_join: si la sesión pide shuffle, fija el orden del
-- participante una sola vez (el on conflict lo deja estable al re-unirse) ----------
create or replace function quiz_join(p_session uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_course     uuid;
  v_status     text;
  v_assignment uuid;
  v_shuffle    boolean;
  v_order      uuid[];
  v_id         uuid;
begin
  select course_id, status, assignment_id, shuffle
    into v_course, v_status, v_assignment, v_shuffle
    from quiz_sessions where id = p_session;
  if v_course is null then raise exception 'Sesión no encontrada.'; end if;
  if v_status = 'ended' then raise exception 'Este quiz ya terminó.'; end if;
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
  return v_id;
end; $$;

-- ---------- quiz_submit_answer: usa el orden propio del participante
-- cuando la sesión está barajada; si no, el orden canónico de siempre ----------
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

-- ---------- Resultados: global (por pregunta) e individual (por
-- participante) — necesarias porque exercise_answers (la respuesta
-- correcta) está bloqueada por RLS para estudiantes. ----------

-- Global: para el profesor dueño del curso, cuántos respondieron y
-- cuántos acertaron cada pregunta de la sesión.
create or replace function quiz_session_stats(p_session uuid)
returns table (
  exercise_id     uuid,
  title           text,
  prompt          text,
  options         jsonb,
  correct_index   int,
  order_index     int,
  total_answers   int,
  correct_answers int
) language plpgsql security definer set search_path = public as $$
declare
  v_course     uuid;
  v_assignment uuid;
begin
  select course_id, assignment_id into v_course, v_assignment
    from quiz_sessions where id = p_session;
  if v_course is null then raise exception 'Sesión no encontrada.'; end if;
  if not owns_course(v_course) then raise exception 'No autorizado.'; end if;

  return query
    select e.id, e.title, e.prompt, e.options, (ea.key->>'correct')::int, e.order_index,
           count(qa.id)::int, count(qa.id) filter (where qa.correct)::int
      from exercises e
      left join exercise_answers ea on ea.exercise_id = e.id
      left join quiz_answers qa on qa.exercise_id = e.id and qa.session_id = p_session
     where e.assignment_id = v_assignment
       and e.type = 'multiple_choice'
       and e.deleted_at is null
     group by e.id, e.title, e.prompt, e.options, ea.key, e.order_index
     order by e.order_index, e.created_at;
end; $$;

-- Individual: el propio estudiante (para su repaso) o el profesor dueño
-- del curso (para revisar a un estudiante puntual) — cada pregunta que
-- respondió, su respuesta, si acertó y cuál era la correcta.
create or replace function quiz_participant_detail(p_participant uuid)
returns table (
  exercise_id   uuid,
  title         text,
  prompt        text,
  options       jsonb,
  correct_index int,
  selected      int,
  is_correct    boolean,
  answered_at   timestamptz,
  order_index   int
) language plpgsql security definer set search_path = public as $$
declare
  v_student uuid;
  v_session uuid;
begin
  select student_id, session_id into v_student, v_session
    from quiz_participants where id = p_participant;
  if v_student is null then raise exception 'Participante no encontrado.'; end if;
  if not (v_student = auth.uid() or owns_course(quiz_session_course(v_session))) then
    raise exception 'No autorizado.';
  end if;

  return query
    select e.id, e.title, e.prompt, e.options, (ea.key->>'correct')::int,
           qa.selected, qa.correct, qa.answered_at, e.order_index
      from quiz_answers qa
      join exercises e on e.id = qa.exercise_id
      left join exercise_answers ea on ea.exercise_id = e.id
     where qa.participant_id = p_participant
     order by e.order_index, e.created_at;
end; $$;

revoke execute on function quiz_start_session(uuid, text, boolean) from anon, public;
revoke execute on function quiz_join(uuid)                         from anon, public;
revoke execute on function quiz_submit_answer(uuid, uuid, int)     from anon, public;
revoke execute on function quiz_session_stats(uuid)                from anon, public;
revoke execute on function quiz_participant_detail(uuid)           from anon, public;
grant  execute on function quiz_start_session(uuid, text, boolean) to authenticated;
grant  execute on function quiz_join(uuid)                         to authenticated;
grant  execute on function quiz_submit_answer(uuid, uuid, int)     to authenticated;
grant  execute on function quiz_session_stats(uuid)                to authenticated;
grant  execute on function quiz_participant_detail(uuid)           to authenticated;
