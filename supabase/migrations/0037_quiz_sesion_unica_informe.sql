-- ============================================================
-- 0037 — Quiz en vivo: UNA sola sesión abierta por tarea, reconexión
-- robusta, bitácora de incidencias y datos para el informe del profe.
--
-- Problemas reales detectados en clase:
--   * Cada clic en "Quiz en vivo" creaba otra sesión (y otro QR): los que
--     llegaban tarde quedaban en una sesión distinta.
--   * Un estudiante que se desconectaba no podía volver a entrar si el quiz
--     ya había terminado, y no quedaba registro de qué pasó.
--
-- Aditivo. Idempotente. Ejecutar DESPUÉS de 0036.
-- ============================================================

-- ---------- Notas del profesor sobre cada quiz (incidencias) ----------
alter table quiz_sessions add column if not exists notes text;

-- ---------- Presencia (último "latido" de cada participante) ----------
-- Tabla aparte y FUERA de realtime: el latido es frecuente y no debe
-- disparar refrescos en todos los celulares.
create table if not exists quiz_presence (
  participant_id uuid primary key references quiz_participants(id) on delete cascade,
  session_id     uuid not null references quiz_sessions(id) on delete cascade,
  last_seen_at   timestamptz not null default now()
);
create index if not exists idx_quiz_presence_session on quiz_presence(session_id);

-- ---------- Bitácora de eventos (entró, volvió, se quedó sin conexión, error) ----------
create table if not exists quiz_events (
  id         uuid primary key default gen_random_uuid(),
  session_id uuid not null references quiz_sessions(id) on delete cascade,
  student_id uuid not null references profiles(id) on delete cascade,
  kind       text not null check (kind in ('join', 'rejoin', 'offline', 'error')),
  detail     jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_quiz_events_session on quiz_events(session_id, created_at);

alter table quiz_presence enable row level security;
alter table quiz_events   enable row level security;

drop policy if exists "quiz presence read" on quiz_presence;
create policy "quiz presence read" on quiz_presence for select
  using (owns_course(quiz_session_course(session_id)));

drop policy if exists "quiz events read" on quiz_events;
create policy "quiz events read" on quiz_events for select
  using (owns_course(quiz_session_course(session_id)));

-- ---------- Una sola sesión abierta por tarea ----------
-- Antes de imponer la regla, se cierran las sesiones abiertas viejas
-- (dejando solo la más reciente de cada tarea): sin esto el índice único
-- no se podría crear si ya hay sesiones sueltas de pruebas.
update quiz_sessions q
   set status = 'ended', ended_at = coalesce(q.ended_at, now())
 where q.status <> 'ended'
   and exists (
     select 1 from quiz_sessions n
      where n.assignment_id = q.assignment_id
        and n.status <> 'ended'
        and (n.created_at, n.id) > (q.created_at, q.id)
   );

create unique index if not exists uq_quiz_one_open_per_assignment
  on quiz_sessions(assignment_id) where status <> 'ended';

-- Si ya hay una sesión abierta para la tarea, se devuelve ESA (mismo QR,
-- mismo enlace) en vez de crear otra.
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
    insert into quiz_sessions (assignment_id, course_id, mode, shuffle, created_by)
    values (p_assignment, v_course, p_mode, coalesce(p_shuffle, false), auth.uid())
    returning id into v_id;
  exception when unique_violation then
    -- Doble clic / dos pestañas a la vez: gana la que ya existe.
    select id into v_id from quiz_sessions
     where assignment_id = p_assignment and status <> 'ended'
     order by created_at desc limit 1;
  end;

  return v_id;
end; $$;

-- ---------- quiz_join: reingresar SIEMPRE funciona si ya eras participante ----------
-- (aunque el quiz haya terminado, para ver tu resultado), y deja
-- constancia de cuando alguien vuelve tras una ausencia.
create or replace function quiz_join(p_session uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_course     uuid;
  v_status     text;
  v_assignment uuid;
  v_shuffle    boolean;
  v_order      uuid[];
  v_id         uuid;
  v_seen       timestamptz;
begin
  select course_id, status, assignment_id, shuffle
    into v_course, v_status, v_assignment, v_shuffle
    from quiz_sessions where id = p_session;
  if v_course is null then raise exception 'Sesión no encontrada.'; end if;

  select id into v_id from quiz_participants
   where session_id = p_session and student_id = auth.uid();

  if v_id is not null then
    -- Volvió: si llevaba más de 60 s sin dar señales, se anota como reconexión.
    select last_seen_at into v_seen from quiz_presence where participant_id = v_id;
    if v_seen is not null and now() - v_seen > interval '60 seconds' then
      insert into quiz_events (session_id, student_id, kind, detail)
      values (p_session, auth.uid(), 'rejoin',
              jsonb_build_object('gap_seconds', extract(epoch from (now() - v_seen))::int));
    end if;
    insert into quiz_presence (participant_id, session_id, last_seen_at)
    values (v_id, p_session, now())
    on conflict (participant_id) do update set last_seen_at = now();
    return v_id;
  end if;

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

  insert into quiz_presence (participant_id, session_id, last_seen_at)
  values (v_id, p_session, now())
  on conflict (participant_id) do update set last_seen_at = now();
  insert into quiz_events (session_id, student_id, kind)
  values (p_session, auth.uid(), 'join');

  return v_id;
end; $$;

-- ---------- Latido: "sigo aquí" (cada ~20 s desde el celular) ----------
create or replace function quiz_heartbeat(p_session uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  select id into v_id from quiz_participants
   where session_id = p_session and student_id = auth.uid();
  if v_id is null then return; end if;
  insert into quiz_presence (participant_id, session_id, last_seen_at)
  values (v_id, p_session, now())
  on conflict (participant_id) do update set last_seen_at = now();
end; $$;

-- ---------- Bitácora desde el celular (se quedó sin conexión / hubo un error) ----------
create or replace function quiz_log_event(p_session uuid, p_kind text, p_detail jsonb default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_course uuid;
  v_n      int;
begin
  if p_kind not in ('offline', 'error') then return; end if;
  select course_id into v_course from quiz_sessions where id = p_session;
  if v_course is null then return; end if;
  if not (is_enrolled(v_course) or owns_course(v_course)) then return; end if;

  -- Tope por estudiante y sesión, para que un bucle de errores no llene la tabla.
  select count(*) into v_n from quiz_events
   where session_id = p_session and student_id = auth.uid();
  if v_n >= 60 then return; end if;

  insert into quiz_events (session_id, student_id, kind, detail)
  values (p_session, auth.uid(), p_kind, p_detail);
end; $$;

-- ---------- Profe: reabrir un quiz que se cerró antes de tiempo ----------
create or replace function quiz_reopen(p_session uuid)
returns void language plpgsql security definer set search_path = public as $$
declare s quiz_sessions;
begin
  select * into s from quiz_sessions where id = p_session;
  if s.id is null then raise exception 'Sesión no encontrada.'; end if;
  if not owns_course(s.course_id) then raise exception 'No autorizado.'; end if;
  if s.status <> 'ended' then raise exception 'Este quiz no está terminado.'; end if;

  begin
    update quiz_sessions
       set status = case when started_at is null then 'lobby' else 'active' end,
           ended_at = null
     where id = p_session;
  exception when unique_violation then
    raise exception 'Ya hay otro quiz abierto en esta tarea. Termínalo primero.';
  end;
end; $$;

-- ---------- Profe: notas / incidencias de un quiz ----------
create or replace function quiz_set_notes(p_session uuid, p_notes text)
returns void language plpgsql security definer set search_path = public as $$
declare v_course uuid;
begin
  select course_id into v_course from quiz_sessions where id = p_session;
  if v_course is null then raise exception 'Sesión no encontrada.'; end if;
  if not owns_course(v_course) then raise exception 'No autorizado.'; end if;
  update quiz_sessions set notes = nullif(btrim(p_notes), '') where id = p_session;
end; $$;

-- ---------- Informe completo de una tarea: todos sus quizzes ----------
-- Un solo viaje: preguntas, inscritos, y por cada sesión participantes,
-- aciertos por pregunta y bitácora. Solo cuentan estudiantes inscritos
-- (las pruebas del profe como participante quedan fuera).
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

revoke execute on function quiz_start_session(uuid, text, boolean) from anon, public;
revoke execute on function quiz_join(uuid)                         from anon, public;
revoke execute on function quiz_heartbeat(uuid)                    from anon, public;
revoke execute on function quiz_log_event(uuid, text, jsonb)       from anon, public;
revoke execute on function quiz_reopen(uuid)                       from anon, public;
revoke execute on function quiz_set_notes(uuid, text)              from anon, public;
revoke execute on function quiz_report(uuid)                       from anon, public;
grant  execute on function quiz_start_session(uuid, text, boolean) to authenticated;
grant  execute on function quiz_join(uuid)                         to authenticated;
grant  execute on function quiz_heartbeat(uuid)                    to authenticated;
grant  execute on function quiz_log_event(uuid, text, jsonb)       to authenticated;
grant  execute on function quiz_reopen(uuid)                       to authenticated;
grant  execute on function quiz_set_notes(uuid, text)              to authenticated;
grant  execute on function quiz_report(uuid)                       to authenticated;
