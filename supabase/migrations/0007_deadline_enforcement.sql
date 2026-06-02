-- ============================================================
-- 0007 — Corte por fecha de cierre y tiempo de examen (server-side)
-- Rechaza envíos después del cierre o del límite de tiempo, aunque
-- el cliente intente burlarlo. Ejecutar DESPUÉS de 0001-0006. Idempotente.
-- ============================================================

create or replace function enforce_assignment_deadline()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  a       record;
  grace   interval := interval '90 seconds';  -- margen para que el auto-envío en t=0 alcance
begin
  -- Solo nos importa la transición a 'submitted'
  if new.status <> 'submitted' then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status = 'submitted' then
    return new;
  end if;

  select asg.closes_at, asg.time_limit_min
    into a
    from exercises e
    join assignments asg on asg.id = e.assignment_id
   where e.id = new.exercise_id;

  -- Sin assignment (práctica libre) → sin límite
  if not found then
    return new;
  end if;

  if a.closes_at is not null and now() > a.closes_at + grace then
    raise exception 'La tarea ya cerró. No se aceptan más envíos.';
  end if;

  if a.time_limit_min is not null and new.started_at is not null
     and now() > new.started_at + make_interval(mins => a.time_limit_min) + grace then
    raise exception 'Se acabó el tiempo del examen.';
  end if;

  return new;
end; $$;

drop trigger if exists t_enforce_deadline on submissions;
create trigger t_enforce_deadline before insert or update on submissions
  for each row execute function enforce_assignment_deadline();
