-- ============================================================
-- 0016 — Un solo intento en modo examen (server-side)
-- Si la tarea es examen (assignments.is_exam), bloquea la creación de
-- un intento nuevo (código, opción múltiple o numérica) cuando el
-- estudiante ya tiene una entrega enviada para ese ejercicio. Los
-- intentos que fallaron al calificar ('error') no cuentan, para no
-- dejar al estudiante sin poder reintentar por un fallo transitorio
-- de la IA. Ejecutar DESPUÉS de 0001-0015. Idempotente.
-- ============================================================

create or replace function enforce_exam_single_attempt()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  exam_flag boolean;
  used_up   boolean;
begin
  select asg.is_exam
    into exam_flag
    from exercises e
    join assignments asg on asg.id = e.assignment_id
   where e.id = new.exercise_id;

  -- Sin assignment (práctica libre) o no es examen → sin restricción
  if exam_flag is not true then
    return new;
  end if;

  select exists (
    select 1 from submissions s
     where s.exercise_id = new.exercise_id
       and s.student_id = new.student_id
       and s.status in ('submitted', 'grading', 'graded')
  ) into used_up;

  if used_up then
    raise exception 'Esta tarea es modo examen: ya usaste tu único intento.';
  end if;

  return new;
end; $$;

drop trigger if exists t_exam_single_attempt on submissions;
create trigger t_exam_single_attempt before insert on submissions
  for each row execute function enforce_exam_single_attempt();
