-- ============================================================
-- 0028 — Recordatorio automático: tareas por vencer sin entregar
-- Cada 15 minutos revisa qué tareas cierran en las próximas 3 horas y
-- les manda una notificación (misma tabla `notifications` que ya usan
-- las demás, así que llega igual por la campanita y por push si el
-- estudiante lo activó) a quienes todavía no han entregado ni un
-- ejercicio de esa tarea. Cada combinación (tarea, estudiante) se
-- avisa una sola vez, aunque el job corra muchas veces.
-- Aditivo. Idempotente.
-- ============================================================

create extension if not exists pg_cron;

create table if not exists assignment_reminders_sent (
  assignment_id uuid not null references assignments(id) on delete cascade,
  student_id    uuid not null references profiles(id) on delete cascade,
  sent_at       timestamptz not null default now(),
  primary key (assignment_id, student_id)
);

-- Solo la toca la función de abajo (security definer); nadie necesita
-- leerla ni escribirla desde el cliente.
alter table assignment_reminders_sent enable row level security;

create or replace function notify_upcoming_deadlines()
returns void language plpgsql security definer set search_path = public as $$
begin
  with due as (
    select a.id as assignment_id, e.student_id, a.title, a.closes_at
      from assignments a
      join enrollments e on e.course_id = a.course_id
     where a.status = 'open'
       and a.deleted_at is null
       and a.closes_at is not null
       and a.closes_at between now() and now() + interval '3 hours'
       and not exists (
         select 1 from assignment_reminders_sent r
          where r.assignment_id = a.id and r.student_id = e.student_id
       )
       and not exists (
         select 1
           from submissions sub
           join exercises ex on ex.id = sub.exercise_id
          where ex.assignment_id = a.id
            and sub.student_id = e.student_id
            and sub.status <> 'draft'
       )
  ),
  marked as (
    insert into assignment_reminders_sent (assignment_id, student_id)
    select assignment_id, student_id from due
    on conflict (assignment_id, student_id) do nothing
    returning assignment_id, student_id
  )
  insert into notifications (user_id, type, title, body, link)
  select d.student_id, 'reminder',
         'Se vence pronto: ' || d.title,
         'Tienes hasta ' || to_char(d.closes_at, 'DD/MM HH24:MI') || ' y todavía no entregas.',
         '/app/assignments/' || d.assignment_id
    from due d
    join marked m
      on m.assignment_id = d.assignment_id and m.student_id = d.student_id;
end; $$;

-- Reprograma el job (evita duplicados si se vuelve a correr esta migración).
select cron.unschedule(jobid)
  from cron.job where jobname = 'notify-upcoming-deadlines';

select cron.schedule(
  'notify-upcoming-deadlines',
  '*/15 * * * *',
  $$select notify_upcoming_deadlines();$$
);
