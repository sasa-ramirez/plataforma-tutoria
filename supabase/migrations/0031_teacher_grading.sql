-- ============================================================
-- 0031 — Nota manual del tutor + blindaje de las notas
--
-- 1) El tutor puede corregir la nota que puso la IA (o calificar una entrega
--    que la IA no pudo revisar) y dejar un comentario. La nota final sigue
--    siendo submissions.score, así que promedios, XP y reportes la usan sin
--    cambios; la nota original de la IA queda guardada en ai_feedback.score.
-- 2) Cierra un hueco: la política "sub student all" deja al estudiante escribir
--    cualquier columna de SU entrega, o sea que podía ponerse score = 100 (o
--    insertar una entrega ya "graded") desde la consola del navegador. Ahora un
--    disparador restaura nota y estado cuando el cambio viene directo del
--    navegador. Las Edge Functions (service_role) y las funciones SECURITY
--    DEFINER (submit_answer, teacher_set_grade) siguen funcionando igual.
-- 3) Mismo hueco con xp y racha del perfil (ranking): ya no se pueden editar
--    desde el navegador.
-- Aditivo. Idempotente.
-- ============================================================

alter table submissions add column if not exists teacher_comment   text;
alter table submissions add column if not exists teacher_graded_at timestamptz;
alter table submissions add column if not exists teacher_graded_by uuid
  references profiles(id) on delete set null;

-- ---------- Blindaje de la nota ----------
create or replace function protect_submission_grades()
returns trigger language plpgsql as $$
begin
  -- La IA (Edge Function con service_role) no pisa una nota que el tutor ya puso.
  if tg_op = 'UPDATE'
     and current_user = 'service_role'
     and old.teacher_graded_at is not null then
    new.score              := old.score;
    new.status             := old.status;
    new.teacher_comment    := old.teacher_comment;
    new.teacher_graded_at  := old.teacher_graded_at;
    new.teacher_graded_by  := old.teacher_graded_by;
    return new;
  end if;

  -- Solo se restringe lo que llega directo del navegador (estudiante).
  if current_user not in ('authenticated', 'anon') then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.score             := null;
    new.teacher_comment   := null;
    new.teacher_graded_at := null;
    new.teacher_graded_by := null;
    if new.status not in ('draft', 'submitted') then new.status := 'draft'; end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    -- Una entrega ya calificada no la modifica el estudiante.
    if old.status = 'graded' then return old; end if;
    new.score             := old.score;
    new.teacher_comment   := old.teacher_comment;
    new.teacher_graded_at := old.teacher_graded_at;
    new.teacher_graded_by := old.teacher_graded_by;
    if new.status not in ('draft', 'submitted', 'error') then
      new.status := old.status;
    end if;
    return new;
  end if;

  -- DELETE: el estudiante solo puede borrar borradores (si no, borraría su
  -- entrega de un examen para volver a intentarlo).
  if old.status <> 'draft' then return null; end if;
  return old;
end; $$;

drop trigger if exists t_protect_submission_grades on submissions;
create trigger t_protect_submission_grades
  before insert or update or delete on submissions
  for each row execute function protect_submission_grades();

-- ---------- Blindaje de xp / racha ----------
create or replace function protect_profile_progress()
returns trigger language plpgsql as $$
begin
  if current_user in ('authenticated', 'anon') then
    new.xp     := old.xp;
    new.streak := old.streak;
  end if;
  return new;
end; $$;

drop trigger if exists t_protect_profile_progress on profiles;
create trigger t_protect_profile_progress
  before update on profiles
  for each row execute function protect_profile_progress();

-- ---------- Nota manual del tutor ----------
create or replace function teacher_set_grade(
  p_submission uuid,
  p_score      int,
  p_comment    text default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  s        record;
  v_course uuid;
  old_pts  int;
  new_pts  int;
  cmt      text := nullif(trim(coalesce(p_comment, '')), '');
begin
  if p_score is null or p_score < 0 or p_score > 100 then
    raise exception 'La nota debe estar entre 0 y 100.';
  end if;

  select sub.id, sub.student_id, sub.status, sub.score, sub.exercise_id,
         ex.assignment_id
    into s
    from submissions sub
    join exercises ex on ex.id = sub.exercise_id
   where sub.id = p_submission;
  if not found then raise exception 'Entrega no encontrada.'; end if;
  if s.assignment_id is null then
    raise exception 'Solo se pueden calificar entregas de tareas de un curso.';
  end if;

  v_course := course_of_assignment(s.assignment_id);
  if not (owns_course(v_course) or is_admin(auth.uid())) then
    raise exception 'No autorizado: solo el tutor del curso puede calificar.';
  end if;
  if s.status = 'draft' then
    raise exception 'El estudiante todavía no ha entregado.';
  end if;

  update submissions
     set score             = p_score,
         status            = 'graded',
         teacher_comment   = cmt,
         teacher_graded_at = now(),
         teacher_graded_by = auth.uid()
   where id = p_submission;

  -- XP: si la IA ya había dado XP por esta entrega, se ajusta la diferencia;
  -- si la IA falló y no había dado nada, se da el XP de esta nota.
  old_pts := greatest(10, coalesce(s.score, 0));
  new_pts := greatest(10, p_score);
  if exists (select 1 from ai_feedback where submission_id = p_submission) then
    if s.status = 'graded' then
      update profiles set xp = greatest(0, xp + (new_pts - old_pts))
       where id = s.student_id;
    end if;
  elsif s.status in ('submitted', 'grading', 'error') then
    update profiles set xp = xp + new_pts where id = s.student_id;
  end if;

  insert into notifications(user_id, type, title, body, link)
  values (
    s.student_id,
    'graded',
    'Tu tutor calificó tu entrega',
    'Nota: ' || p_score || '/100' ||
      case when cmt is not null then ' — ' || left(cmt, 140) else '' end,
    '/app/solve/' || s.exercise_id
  );

  return jsonb_build_object('ok', true, 'score', p_score);
end; $$;

revoke execute on function teacher_set_grade(uuid, int, text) from anon, public;
grant  execute on function teacher_set_grade(uuid, int, text) to authenticated;
