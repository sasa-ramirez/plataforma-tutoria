-- ============================================================
-- 0004 — Gamificación: XP, racha y ranking
-- Ejecutar DESPUÉS de 0001-0003. Idempotente.
-- ============================================================

-- Al calificar (insertar ai_feedback) se otorga XP y se actualiza la racha.
create or replace function award_progress_on_feedback()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  sid  uuid;
  last date;
  pts  int;
begin
  select student_id into sid from submissions where id = new.submission_id;
  if sid is null then return new; end if;

  pts := greatest(10, coalesce(new.score, 0));   -- mínimo 10 XP, hasta 100
  select last_active into last from profiles where id = sid;

  update profiles
     set xp = xp + pts,
         streak = case
           when last = current_date then streak           -- ya activo hoy
           when last = current_date - 1 then streak + 1    -- día consecutivo
           else 1                                          -- racha reiniciada
         end,
         last_active = current_date
   where id = sid;

  return new;
end; $$;

drop trigger if exists t_award_progress on ai_feedback;
create trigger t_award_progress after insert on ai_feedback
  for each row execute function award_progress_on_feedback();

-- Ranking: top estudiantes por XP. SECURITY DEFINER para leer perfiles
-- (RLS los protege) pero devuelve SOLO columnas públicas (sin correo).
create or replace function get_leaderboard(limit_n int default 20)
returns table (
  id uuid,
  full_name text,
  avatar_url text,
  xp int,
  streak int
)
language sql stable security definer set search_path = public as $$
  select id, full_name, avatar_url, xp, streak
    from profiles
   where deleted_at is null and role = 'student'
   order by xp desc, streak desc, created_at asc
   limit greatest(1, least(limit_n, 100));
$$;

-- Solo usuarios autenticados pueden ver el ranking (no anónimos).
revoke execute on function get_leaderboard(int) from anon, public;
grant execute on function get_leaderboard(int) to authenticated;
