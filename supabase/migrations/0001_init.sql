-- ============================================================
-- Plataforma de Tutoría — Esquema inicial
-- Postgres / Supabase · RLS · soft delete · timestamps
-- ============================================================

-- ---------- Extensiones ----------
create extension if not exists "pgcrypto";

-- ---------- Enums ----------
do $$ begin
  create type user_role         as enum ('student', 'teacher');
  create type difficulty        as enum ('beginner', 'easy', 'medium', 'hard');
  create type prog_language     as enum ('pseint', 'java', 'python', 'logic');
  create type assignment_status as enum ('draft', 'open', 'closed');
  create type submission_status as enum ('draft', 'submitted', 'grading', 'graded', 'error');
  create type exam_event        as enum (
    'tab_blur','tab_focus','window_hidden','window_visible',
    'paste','copy','fullscreen_exit'
  );
exception when duplicate_object then null; end $$;

-- ---------- Util: updated_at ----------
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

-- ============================================================
-- profiles  (1:1 con auth.users)
-- ============================================================
create table if not exists profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  full_name   text,
  avatar_url  text,
  role        user_role not null default 'student',
  streak      int not null default 0,
  xp          int not null default 0,
  last_active date,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);
create trigger t_profiles_updated before update on profiles
  for each row execute function set_updated_at();

-- Crea profile automáticamente al registrarse
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)),
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'student')
  );
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ============================================================
-- courses
-- ============================================================
create table if not exists courses (
  id          uuid primary key default gen_random_uuid(),
  teacher_id  uuid not null references profiles(id) on delete cascade,
  title       text not null,
  description text,
  color       text default 'violet',
  join_code   text unique not null default upper(substr(md5(random()::text),1,6)),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);
create index on courses(teacher_id);
create trigger t_courses_updated before update on courses
  for each row execute function set_updated_at();

-- ============================================================
-- enrollments
-- ============================================================
create table if not exists enrollments (
  id          uuid primary key default gen_random_uuid(),
  course_id   uuid not null references courses(id) on delete cascade,
  student_id  uuid not null references profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (course_id, student_id)
);
create index on enrollments(student_id);

-- ============================================================
-- assignments  (tareas)
-- ============================================================
create table if not exists assignments (
  id            uuid primary key default gen_random_uuid(),
  course_id     uuid not null references courses(id) on delete cascade,
  title         text not null,
  description   text,
  instructions  text,
  difficulty    difficulty not null default 'beginner',
  language      prog_language not null default 'pseint',
  points        int not null default 100,
  status        assignment_status not null default 'draft',
  is_exam       boolean not null default false,   -- activa modo examen
  time_limit_min int,                              -- opcional
  opens_at      timestamptz,
  closes_at     timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);
create index on assignments(course_id);
create trigger t_assignments_updated before update on assignments
  for each row execute function set_updated_at();

-- ¿La tarea está abierta ahora? (helper para UI y políticas)
create or replace function assignment_is_available(a assignments)
returns boolean language sql stable as $$
  select a.status = 'open'
     and (a.opens_at is null or a.opens_at <= now())
     and (a.closes_at is null or a.closes_at >= now());
$$;

-- ============================================================
-- exercises  (de tarea o de práctica libre)
-- ============================================================
create table if not exists exercises (
  id             uuid primary key default gen_random_uuid(),
  assignment_id  uuid references assignments(id) on delete cascade, -- null = práctica
  is_practice    boolean not null default false,
  title          text not null,
  prompt         text not null,            -- enunciado
  starter_code   text default '',
  solution_code  text,                     -- visible tras resolver/cierre
  language       prog_language not null default 'pseint',
  difficulty     difficulty not null default 'beginner',
  points         int not null default 100,
  order_index    int not null default 0,
  created_by     uuid references profiles(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz
);
create index on exercises(assignment_id);
create index on exercises(is_practice);
create trigger t_exercises_updated before update on exercises
  for each row execute function set_updated_at();

-- ============================================================
-- submissions
-- ============================================================
create table if not exists submissions (
  id            uuid primary key default gen_random_uuid(),
  exercise_id   uuid not null references exercises(id) on delete cascade,
  student_id    uuid not null references profiles(id) on delete cascade,
  code          text not null default '',
  language      prog_language not null default 'pseint',
  status        submission_status not null default 'draft',
  score         int,                       -- 0..100 (lo pone la IA)
  attempt       int not null default 1,
  started_at    timestamptz default now(),
  submitted_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);
create index on submissions(exercise_id);
create index on submissions(student_id);
create trigger t_submissions_updated before update on submissions
  for each row execute function set_updated_at();

-- ============================================================
-- ai_feedback  (1:1 con submission)
-- ============================================================
create table if not exists ai_feedback (
  id            uuid primary key default gen_random_uuid(),
  submission_id uuid not null unique references submissions(id) on delete cascade,
  score         int not null,              -- 1..100
  summary       text,                      -- feedback amigable
  errors        jsonb default '[]'::jsonb, -- [{line, message, severity}]
  suggestions   jsonb default '[]'::jsonb, -- ["..."]
  strengths     jsonb default '[]'::jsonb,
  model         text,                      -- modelo de OpenRouter usado
  raw           jsonb,                     -- respuesta cruda (debug)
  created_at    timestamptz not null default now()
);

-- ============================================================
-- exam_logs  (anti-trampa, append-only)
-- ============================================================
create table if not exists exam_logs (
  id            uuid primary key default gen_random_uuid(),
  submission_id uuid not null references submissions(id) on delete cascade,
  student_id    uuid not null references profiles(id) on delete cascade,
  event_type    exam_event not null,
  meta          jsonb default '{}'::jsonb, -- {chars, durationMs, ...}
  created_at    timestamptz not null default now()
);
create index on exam_logs(submission_id);

-- ============================================================
-- practice_sessions
-- ============================================================
create table if not exists practice_sessions (
  id           uuid primary key default gen_random_uuid(),
  student_id   uuid not null references profiles(id) on delete cascade,
  exercise_id  uuid not null references exercises(id) on delete cascade,
  attempts     int not null default 1,
  best_score   int,
  completed    boolean not null default false,
  last_code    text default '',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index on practice_sessions(student_id);
create trigger t_practice_updated before update on practice_sessions
  for each row execute function set_updated_at();

-- ============================================================
-- Helpers de seguridad
-- ============================================================
create or replace function is_teacher(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from profiles where id = uid and role = 'teacher');
$$;

create or replace function owns_course(cid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from courses where id = cid and teacher_id = auth.uid());
$$;

create or replace function is_enrolled(cid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(
    select 1 from enrollments where course_id = cid and student_id = auth.uid()
  );
$$;

-- course al que pertenece una assignment
create or replace function course_of_assignment(aid uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select course_id from assignments where id = aid;
$$;

-- ============================================================
-- RLS
-- ============================================================
alter table profiles          enable row level security;
alter table courses           enable row level security;
alter table enrollments       enable row level security;
alter table assignments       enable row level security;
alter table exercises         enable row level security;
alter table submissions       enable row level security;
alter table ai_feedback       enable row level security;
alter table exam_logs         enable row level security;
alter table practice_sessions enable row level security;

-- profiles
create policy "profiles read all"   on profiles for select using (deleted_at is null);
create policy "profiles update own" on profiles for update using (id = auth.uid());

-- courses
create policy "courses teacher all" on courses for all
  using (teacher_id = auth.uid()) with check (teacher_id = auth.uid());
create policy "courses enrolled read" on courses for select
  using (deleted_at is null and is_enrolled(id));

-- enrollments
create policy "enroll self" on enrollments for insert
  with check (student_id = auth.uid());
create policy "enroll read own" on enrollments for select
  using (student_id = auth.uid() or owns_course(course_id));
create policy "enroll delete own" on enrollments for delete
  using (student_id = auth.uid() or owns_course(course_id));

-- assignments
create policy "assign teacher all" on assignments for all
  using (owns_course(course_id)) with check (owns_course(course_id));
create policy "assign student read" on assignments for select
  using (
    deleted_at is null and is_enrolled(course_id)
    and (status <> 'draft')
  );

-- exercises
create policy "ex teacher all" on exercises for all
  using (
    is_practice = false and owns_course(course_of_assignment(assignment_id))
  )
  with check (
    is_practice = false and owns_course(course_of_assignment(assignment_id))
  );
create policy "ex practice read" on exercises for select
  using (is_practice = true and deleted_at is null);
create policy "ex student read" on exercises for select
  using (
    deleted_at is null and assignment_id is not null
    and is_enrolled(course_of_assignment(assignment_id))
  );
-- cualquier autenticado puede crear ejercicios de práctica propios
create policy "ex practice create" on exercises for insert
  with check (is_practice = true and created_by = auth.uid());

-- submissions
create policy "sub student all" on submissions for all
  using (student_id = auth.uid()) with check (student_id = auth.uid());
create policy "sub teacher read" on submissions for select
  using (
    exists (
      select 1 from exercises e
      where e.id = exercise_id
        and e.assignment_id is not null
        and owns_course(course_of_assignment(e.assignment_id))
    )
  );

-- ai_feedback  (escritura solo service-role / Edge Function)
create policy "fb read owner+teacher" on ai_feedback for select
  using (
    exists (
      select 1 from submissions s
      where s.id = submission_id
        and (
          s.student_id = auth.uid()
          or exists (
            select 1 from exercises e
            where e.id = s.exercise_id and e.assignment_id is not null
              and owns_course(course_of_assignment(e.assignment_id))
          )
        )
    )
  );

-- exam_logs (append-only del estudiante; profesor lee)
create policy "exam insert own" on exam_logs for insert
  with check (student_id = auth.uid());
create policy "exam read owner+teacher" on exam_logs for select
  using (
    student_id = auth.uid()
    or exists (
      select 1 from submissions s
      join exercises e on e.id = s.exercise_id
      where s.id = submission_id and e.assignment_id is not null
        and owns_course(course_of_assignment(e.assignment_id))
    )
  );

-- practice_sessions (solo dueño)
create policy "practice own all" on practice_sessions for all
  using (student_id = auth.uid()) with check (student_id = auth.uid());
