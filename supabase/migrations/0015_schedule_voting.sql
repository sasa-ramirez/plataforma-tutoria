-- ============================================================
-- 0015 — Cuadrar horario por votación (tutor propone, alumnos votan)
-- El horario del grupo (courses.schedule) queda automáticamente en la
-- opción MÁS VOTADA. Aditivo. Ejecutar DESPUÉS de 0001-0014. Idempotente.
-- ============================================================

-- Opciones de horario que propone el tutor.
create table if not exists schedule_options (
  id         uuid primary key default gen_random_uuid(),
  course_id  uuid not null references courses(id) on delete cascade,
  label      text not null,                 -- "Lun y Mié 2–4pm"
  created_at timestamptz not null default now()
);
create index if not exists idx_sched_opt_course on schedule_options(course_id);

-- Votos de los estudiantes (puede votar varias opciones que le sirvan).
create table if not exists schedule_votes (
  id         uuid primary key default gen_random_uuid(),
  option_id  uuid not null references schedule_options(id) on delete cascade,
  course_id  uuid not null references courses(id) on delete cascade,
  student_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (option_id, student_id)
);
create index if not exists idx_sched_vote_course on schedule_votes(course_id);

alter table schedule_options enable row level security;
alter table schedule_votes   enable row level security;

-- ---------- RLS ----------
-- Opciones: las gestiona el tutor (dueño del curso); las leen inscritos,
-- tutor y coordinación.
drop policy if exists "sched opt read" on schedule_options;
create policy "sched opt read" on schedule_options for select
  using (is_enrolled(course_id) or owns_course(course_id) or can_view_reports());
drop policy if exists "sched opt write" on schedule_options;
create policy "sched opt write" on schedule_options for all
  using (owns_course(course_id)) with check (owns_course(course_id));

-- Votos: el estudiante gestiona SOLO los suyos (en cursos donde está inscrito).
drop policy if exists "sched vote read" on schedule_votes;
create policy "sched vote read" on schedule_votes for select
  using (is_enrolled(course_id) or owns_course(course_id) or can_view_reports());
drop policy if exists "sched vote insert own" on schedule_votes;
create policy "sched vote insert own" on schedule_votes for insert
  with check (student_id = auth.uid() and is_enrolled(course_id));
drop policy if exists "sched vote delete own" on schedule_votes;
create policy "sched vote delete own" on schedule_votes for delete
  using (student_id = auth.uid());

-- ---------- Cálculo automático del horario (más votado) ----------
create or replace function recompute_schedule(p_course uuid)
returns void language plpgsql security definer set search_path = public as $$
declare top_label text;
begin
  select o.label into top_label
    from schedule_options o
    left join schedule_votes v on v.option_id = o.id
   where o.course_id = p_course
   group by o.id, o.label, o.created_at
   order by count(v.id) desc, o.created_at asc
   limit 1;

  -- Solo fija el horario si ya hay al menos un voto.
  if exists (
    select 1 from schedule_votes v
    join schedule_options o on o.id = v.option_id
    where o.course_id = p_course
  ) then
    update courses set schedule = top_label where id = p_course;
  end if;
end; $$;

create or replace function t_recompute_schedule()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform recompute_schedule(coalesce(new.course_id, old.course_id));
  return null;
end; $$;

drop trigger if exists t_sched_vote_change on schedule_votes;
create trigger t_sched_vote_change
  after insert or delete on schedule_votes
  for each row execute function t_recompute_schedule();

-- ---------- Lectura: opciones con conteo de votos y si YO voté ----------
create or replace function schedule_options_with_votes(p_course uuid)
returns table(id uuid, label text, votes bigint, mine boolean)
language plpgsql security definer set search_path = public as $$
begin
  if not (is_enrolled(p_course) or owns_course(p_course) or can_view_reports()) then
    raise exception 'No autorizado';
  end if;
  return query
    select o.id, o.label,
      (select count(*) from schedule_votes v where v.option_id = o.id),
      exists(select 1 from schedule_votes v where v.option_id = o.id and v.student_id = auth.uid())
    from schedule_options o
    where o.course_id = p_course
    order by (select count(*) from schedule_votes v where v.option_id = o.id) desc,
             o.created_at asc;
end; $$;
