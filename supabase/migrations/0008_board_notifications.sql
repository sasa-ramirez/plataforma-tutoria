-- ============================================================
-- 0008 — Tablero en vivo + Notificaciones
-- Ejecutar DESPUÉS de 0001-0007. Idempotente.
-- ============================================================

-- ---------- TABLERO (uno por curso) ----------
create table if not exists boards (
  id           uuid primary key default gen_random_uuid(),
  course_id    uuid not null unique references courses(id) on delete cascade,
  text_content text default '',
  updated_at   timestamptz not null default now()
);
drop trigger if exists t_boards_updated on boards;
create trigger t_boards_updated before update on boards
  for each row execute function set_updated_at();

-- Trazos persistidos (para quien entra a mitad de clase)
create table if not exists board_strokes (
  id         uuid primary key default gen_random_uuid(),
  board_id   uuid not null references boards(id) on delete cascade,
  data       jsonb not null,   -- { points:[{x,y}...], color, width, mode }
  created_at timestamptz not null default now()
);
create index if not exists idx_board_strokes on board_strokes(board_id, created_at);

create or replace function board_course(bid uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select course_id from boards where id = bid;
$$;

alter table boards        enable row level security;
alter table board_strokes enable row level security;

drop policy if exists "board teacher all" on boards;
create policy "board teacher all" on boards for all
  using (owns_course(course_id)) with check (owns_course(course_id));
drop policy if exists "board student read" on boards;
create policy "board student read" on boards for select
  using (is_enrolled(course_id));

drop policy if exists "strokes teacher all" on board_strokes;
create policy "strokes teacher all" on board_strokes for all
  using (owns_course(board_course(board_id)))
  with check (owns_course(board_course(board_id)));
drop policy if exists "strokes student read" on board_strokes;
create policy "strokes student read" on board_strokes for select
  using (is_enrolled(board_course(board_id)));

-- ---------- NOTIFICACIONES ----------
create table if not exists notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles(id) on delete cascade,
  type       text not null,
  title      text not null,
  body       text,
  link       text,
  read       boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_notif_user on notifications(user_id, created_at desc);

alter table notifications enable row level security;
drop policy if exists "notif read own" on notifications;
create policy "notif read own" on notifications for select using (user_id = auth.uid());
drop policy if exists "notif update own" on notifications;
create policy "notif update own" on notifications for update using (user_id = auth.uid());
-- (los inserts los hacen triggers SECURITY DEFINER)

-- Realtime para la campanita en vivo
do $$ begin
  alter publication supabase_realtime add table notifications;
exception when others then null; end $$;

-- Trigger 1: al calificar → avisar al estudiante
create or replace function notify_on_feedback()
returns trigger language plpgsql security definer set search_path = public as $$
declare sid uuid;
begin
  select student_id into sid from submissions where id = new.submission_id;
  if sid is not null then
    insert into notifications(user_id, type, title, body)
    values (sid, 'graded', '¡Tu ejercicio fue calificado!',
            'Obtuviste ' || new.score || '/100');
  end if;
  return new;
end; $$;
drop trigger if exists t_notify_feedback on ai_feedback;
create trigger t_notify_feedback after insert on ai_feedback
  for each row execute function notify_on_feedback();

-- Trigger 2: nueva tarea publicada → avisar a los inscritos
create or replace function notify_on_assignment()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'open'
     and (tg_op = 'INSERT' or old.status is distinct from 'open') then
    insert into notifications(user_id, type, title, body, link)
    select e.student_id, 'assignment', 'Nueva tarea publicada', new.title,
           '/app/assignments/' || new.id
      from enrollments e
     where e.course_id = new.course_id;
  end if;
  return new;
end; $$;
drop trigger if exists t_notify_assignment on assignments;
create trigger t_notify_assignment after insert or update on assignments
  for each row execute function notify_on_assignment();

-- Trigger 3: profesor aprobado → avisar
create or replace function notify_on_teacher_approved()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'approved' and old.status <> 'approved' then
    insert into notifications(user_id, type, title, body)
    values (new.user_id, 'teacher_approved', '¡Ya eres profesor! 🎉',
            'Tu solicitud fue aprobada.');
  end if;
  return new;
end; $$;
drop trigger if exists t_notify_teacher on teacher_requests;
create trigger t_notify_teacher after update on teacher_requests
  for each row execute function notify_on_teacher_approved();
