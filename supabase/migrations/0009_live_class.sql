-- ============================================================
-- 0009 — Clase en vivo (transmitir) + aviso a estudiantes
-- El profe "empieza a transmitir" (boards.is_live = true) y a los
-- inscritos les llega una notificación con enlace al tablero.
-- Ejecutar DESPUÉS de 0001-0008. Idempotente.
-- ============================================================

alter table boards add column if not exists is_live         boolean not null default false;
alter table boards add column if not exists live_started_at timestamptz;

-- Realtime: que el cambio de estado viaje en vivo a quien ya tenga el tablero abierto.
do $$ begin
  alter publication supabase_realtime add table boards;
exception when others then null; end $$;

-- Al pasar a EN VIVO → avisar a los estudiantes inscritos.
create or replace function notify_on_live()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.is_live = true and (old.is_live is distinct from true) then
    insert into notifications(user_id, type, title, body, link)
    select e.student_id, 'live', 'Tu clase está en vivo 🔴',
           'El profe empezó a transmitir. Entra ahora.',
           '/app/courses/' || new.course_id || '/board'
      from enrollments e
     where e.course_id = new.course_id;
  end if;
  return new;
end; $$;

drop trigger if exists t_notify_live on boards;
create trigger t_notify_live after update on boards
  for each row execute function notify_on_live();
