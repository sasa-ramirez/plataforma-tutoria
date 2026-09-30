-- ============================================================
-- 0035 — Quiz en vivo (dos modos: sincronizado o a su ritmo)
--
-- Reutiliza los ejercicios de opción múltiple que ya existen bajo una
-- tarea (assignments/exercises/exercise_answers) — un "quiz en vivo" es
-- una SESIÓN sobre esas mismas preguntas, no un banco de preguntas
-- aparte. El tutor elige el modo al iniciar:
--   'sync' — todos ven la misma pregunta a la vez; el tutor la avanza
--            (como Kahoot).
--   'pace' — cada estudiante avanza a su ritmo (como Quizizz).
--
-- Todas las escrituras pasan por funciones SECURITY DEFINER: las tablas
-- solo tienen política de LECTURA para authenticated, así un estudiante
-- no puede escribirse su propio puntaje desde la consola del navegador.
-- Aditivo. Idempotente.
-- ============================================================

create table if not exists quiz_sessions (
  id             uuid primary key default gen_random_uuid(),
  assignment_id  uuid not null references assignments(id) on delete cascade,
  course_id      uuid not null references courses(id) on delete cascade,
  mode           text not null check (mode in ('sync', 'pace')),
  status         text not null default 'lobby' check (status in ('lobby', 'active', 'ended')),
  current_index  int not null default 0,  -- solo se usa en modo 'sync'
  started_at     timestamptz,
  ended_at       timestamptz,
  created_by     uuid references profiles(id) on delete set null,
  created_at     timestamptz not null default now()
);
create index if not exists idx_quiz_sessions_course on quiz_sessions(course_id, created_at desc);

create table if not exists quiz_participants (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid not null references quiz_sessions(id) on delete cascade,
  student_id    uuid not null references profiles(id) on delete cascade,
  score         int not null default 0,
  current_index int not null default 0,  -- su propio avance (modo 'pace')
  joined_at     timestamptz not null default now(),
  unique (session_id, student_id)
);
create index if not exists idx_quiz_participants_session on quiz_participants(session_id, score desc);

create table if not exists quiz_answers (
  id             uuid primary key default gen_random_uuid(),
  session_id     uuid not null references quiz_sessions(id) on delete cascade,
  participant_id uuid not null references quiz_participants(id) on delete cascade,
  exercise_id    uuid not null references exercises(id) on delete cascade,
  selected       int not null,
  correct        boolean not null,
  answered_at    timestamptz not null default now(),
  unique (participant_id, exercise_id)
);

-- ---------- Helpers ----------
create or replace function quiz_session_course(p_session uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select course_id from quiz_sessions where id = p_session;
$$;

create or replace function student_id_of(p_participant uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select student_id from quiz_participants where id = p_participant;
$$;

-- ---------- RLS: solo LECTURA directa; toda escritura va por RPC ----------
alter table quiz_sessions     enable row level security;
alter table quiz_participants enable row level security;
alter table quiz_answers      enable row level security;

drop policy if exists "quiz sessions read" on quiz_sessions;
create policy "quiz sessions read" on quiz_sessions for select
  using (owns_course(course_id) or is_enrolled(course_id));

drop policy if exists "quiz participants read" on quiz_participants;
create policy "quiz participants read" on quiz_participants for select
  using (
    owns_course(quiz_session_course(session_id))
    or is_enrolled(quiz_session_course(session_id))
  );

drop policy if exists "quiz answers read" on quiz_answers;
create policy "quiz answers read" on quiz_answers for select
  using (
    student_id_of(participant_id) = auth.uid()
    or owns_course(quiz_session_course(session_id))
  );

-- ---------- RPCs ----------

-- El tutor inicia una sesión sobre una tarea que ya tiene preguntas de
-- opción múltiple. Elige el modo aquí; se puede volver a iniciar otra
-- sesión de la misma tarea las veces que haga falta.
create or replace function quiz_start_session(p_assignment uuid, p_mode text)
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

  insert into quiz_sessions (assignment_id, course_id, mode, created_by)
  values (p_assignment, v_course, p_mode, auth.uid())
  returning id into v_id;

  return v_id;
end; $$;

-- Un estudiante inscrito se une a la sesión (re-unirse, ej. al recargar
-- la página, no hace nada raro: es idempotente).
create or replace function quiz_join(p_session uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_course uuid;
  v_status text;
  v_id     uuid;
begin
  select course_id, status into v_course, v_status from quiz_sessions where id = p_session;
  if v_course is null then raise exception 'Sesión no encontrada.'; end if;
  if v_status = 'ended' then raise exception 'Este quiz ya terminó.'; end if;
  if not (is_enrolled(v_course) or owns_course(v_course)) then
    raise exception 'No autorizado.';
  end if;

  insert into quiz_participants (session_id, student_id)
  values (p_session, auth.uid())
  on conflict (session_id, student_id) do nothing;

  select id into v_id from quiz_participants
   where session_id = p_session and student_id = auth.uid();
  return v_id;
end; $$;

-- Responde la pregunta actual. En modo 'sync' debe ser la pregunta que el
-- tutor tiene activa; en modo 'pace', la que le toca según su propio avance.
create or replace function quiz_submit_answer(p_session uuid, p_exercise uuid, p_selected int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  s     quiz_sessions;
  part  quiz_participants;
  ex    record;
  is_ok boolean;
  pts   int;
begin
  select * into s from quiz_sessions where id = p_session;
  if s.id is null then raise exception 'Sesión no encontrada.'; end if;
  if s.status <> 'active' then raise exception 'El quiz no está activo ahora mismo.'; end if;

  select * into part from quiz_participants
   where session_id = p_session and student_id = auth.uid();
  if part.id is null then raise exception 'Primero debes unirte al quiz.'; end if;

  -- El row_number() se calcula sobre TODAS las preguntas de la tarea (para
  -- saber en qué posición va cada una) y solo después se filtra la que
  -- llegó — filtrar antes daría siempre posición 0.
  select sub.id, sub.key, sub.idx into ex
    from (
      select e.id, ea.key,
             row_number() over (order by e.order_index, e.created_at) - 1 as idx
        from exercises e
        left join exercise_answers ea on ea.exercise_id = e.id
       where e.assignment_id = s.assignment_id
         and e.type = 'multiple_choice'
         and e.deleted_at is null
    ) sub
   where sub.id = p_exercise;
  if ex.id is null then raise exception 'Pregunta no válida para este quiz.'; end if;

  if s.mode = 'sync' and ex.idx <> s.current_index then
    raise exception 'Esa no es la pregunta activa ahora mismo.';
  end if;
  if s.mode = 'pace' and ex.idx <> part.current_index then
    raise exception 'Responde las preguntas en orden.';
  end if;

  is_ok := (ex.key->>'correct') = p_selected::text;
  pts := case when is_ok then 100 else 0 end;

  begin
    insert into quiz_answers (session_id, participant_id, exercise_id, selected, correct)
    values (p_session, part.id, p_exercise, p_selected, is_ok);
  exception when unique_violation then
    raise exception 'Ya respondiste esta pregunta.';
  end;

  update quiz_participants
     set score = score + pts,
         current_index = greatest(current_index, ex.idx + 1)
   where id = part.id;

  return jsonb_build_object('correct', is_ok, 'points', pts);
end; $$;

-- El tutor arranca la sesión (lobby -> active) — sirve para los dos modos.
create or replace function quiz_start(p_session uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_course uuid; v_status text;
begin
  select course_id, status into v_course, v_status from quiz_sessions where id = p_session;
  if v_course is null then raise exception 'Sesión no encontrada.'; end if;
  if not owns_course(v_course) then raise exception 'No autorizado.'; end if;
  if v_status <> 'lobby' then raise exception 'El quiz ya se inició.'; end if;

  update quiz_sessions
     set status = 'active', started_at = now(), current_index = 0
   where id = p_session;
end; $$;

-- Modo 'sync': el tutor pasa a la siguiente pregunta (o termina el quiz si
-- ya no hay más).
create or replace function quiz_next(p_session uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  s      quiz_sessions;
  v_last int;
begin
  select * into s from quiz_sessions where id = p_session;
  if s.id is null then raise exception 'Sesión no encontrada.'; end if;
  if not owns_course(s.course_id) then raise exception 'No autorizado.'; end if;
  if s.mode <> 'sync' then raise exception 'Esta sesión no es de modo sincronizado.'; end if;
  if s.status <> 'active' then raise exception 'El quiz no está activo.'; end if;

  select count(*) - 1 into v_last
    from exercises
   where assignment_id = s.assignment_id and type = 'multiple_choice' and deleted_at is null;

  if s.current_index >= v_last then
    update quiz_sessions set status = 'ended', ended_at = now() where id = p_session;
    return jsonb_build_object('ended', true);
  end if;

  update quiz_sessions set current_index = current_index + 1 where id = p_session;
  return jsonb_build_object('ended', false);
end; $$;

-- El tutor termina el quiz cuando quiera (los dos modos).
create or replace function quiz_end(p_session uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_course uuid;
begin
  select course_id into v_course from quiz_sessions where id = p_session;
  if v_course is null then raise exception 'Sesión no encontrada.'; end if;
  if not owns_course(v_course) then raise exception 'No autorizado.'; end if;

  update quiz_sessions set status = 'ended', ended_at = now() where id = p_session;
end; $$;

revoke execute on function quiz_start_session(uuid, text) from anon, public;
revoke execute on function quiz_join(uuid)                from anon, public;
revoke execute on function quiz_submit_answer(uuid, uuid, int) from anon, public;
revoke execute on function quiz_start(uuid)                from anon, public;
revoke execute on function quiz_next(uuid)                 from anon, public;
revoke execute on function quiz_end(uuid)                  from anon, public;
grant  execute on function quiz_start_session(uuid, text) to authenticated;
grant  execute on function quiz_join(uuid)                to authenticated;
grant  execute on function quiz_submit_answer(uuid, uuid, int) to authenticated;
grant  execute on function quiz_start(uuid)                to authenticated;
grant  execute on function quiz_next(uuid)                 to authenticated;
grant  execute on function quiz_end(uuid)                  to authenticated;

-- Realtime: para que el tablero del tutor y la pantalla del estudiante se
-- actualicen solos (nuevo participante, cambio de pregunta, puntaje).
do $$ begin
  alter publication supabase_realtime add table quiz_sessions;
exception when others then null; end $$;
do $$ begin
  alter publication supabase_realtime add table quiz_participants;
exception when others then null; end $$;
