-- ============================================================
-- 0012 — Tipos de ejercicio (Fase B): código / opción múltiple / numérica / abierta
-- Aditivo: los ejercicios existentes quedan como 'code' y NO cambian.
-- Ejecutar DESPUÉS de 0001-0011. Idempotente.
-- ============================================================

-- Tipo de ejercicio (por defecto 'code' → todo lo viejo sigue igual)
alter table exercises add column if not exists type text not null default 'code'
  check (type in ('code', 'multiple_choice', 'numeric', 'open'));

-- Datos PÚBLICOS del enunciado (p. ej. las opciones de selección múltiple).
alter table exercises add column if not exists options jsonb not null default '[]'::jsonb;

-- Respuesta del alumno para tipos no-código (selección, número, texto).
alter table submissions add column if not exists answer jsonb;

-- ---------- Clave de respuesta PRIVADA ----------
-- Correcta / tolerancia / rúbrica. El ALUMNO no puede leerla (RLS); la
-- calificación la hace la función submit_answer (SECURITY DEFINER).
create table if not exists exercise_answers (
  exercise_id uuid primary key references exercises(id) on delete cascade,
  key         jsonb not null default '{}'::jsonb
);
alter table exercise_answers enable row level security;

drop policy if exists "answers teacher only" on exercise_answers;
create policy "answers teacher only" on exercise_answers for all
  using (
    exists (
      select 1 from exercises e
      where e.id = exercise_id
        and (
          (e.assignment_id is not null and owns_course(course_of_assignment(e.assignment_id)))
          or e.created_by = auth.uid()
        )
    )
  )
  with check (
    exists (
      select 1 from exercises e
      where e.id = exercise_id
        and (
          (e.assignment_id is not null and owns_course(course_of_assignment(e.assignment_id)))
          or e.created_by = auth.uid()
        )
    )
  );

-- ---------- Calificación automática (segura) ----------
-- El alumno envía su respuesta; la función lee la clave privada, califica
-- y registra la entrega. Nunca expone la respuesta correcta al cliente.
create or replace function submit_answer(p_exercise_id uuid, p_answer jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  ex      exercises;
  k       jsonb;
  sc      int := 0;
  correct boolean := false;
  v       numeric;
  ans     numeric;
  tol     numeric;
  sub_id  uuid;
begin
  select * into ex from exercises where id = p_exercise_id and deleted_at is null;
  if not found then raise exception 'Ejercicio no encontrado'; end if;

  -- Corte por cierre de la tarea (si aplica)
  if ex.assignment_id is not null then
    perform 1 from assignments a
      where a.id = ex.assignment_id
        and (a.closes_at is null or now() <= a.closes_at + interval '90 seconds');
    if not found then raise exception 'La tarea ya cerró. No se aceptan más envíos.'; end if;
  end if;

  select key into k from exercise_answers where exercise_id = p_exercise_id;
  k := coalesce(k, '{}'::jsonb);

  if ex.type = 'multiple_choice' then
    correct := (p_answer->>'selected') is not null
               and (p_answer->>'selected') = (k->>'correct');
    sc := case when correct then 100 else 0 end;

  elsif ex.type = 'numeric' then
    begin
      v   := (p_answer->>'value')::numeric;
      ans := (k->>'value')::numeric;
      tol := coalesce((k->>'tolerance')::numeric, 0);
      correct := abs(v - ans) <= tol;
      sc := case when correct then 100 else 0 end;
    exception when others then
      sc := 0; correct := false;
    end;

  else
    raise exception 'Este tipo no se califica automáticamente';
  end if;

  insert into submissions
    (exercise_id, student_id, code, language, answer, status, score, submitted_at)
  values
    (p_exercise_id, auth.uid(), '', ex.language, p_answer, 'graded', sc, now())
  returning id into sub_id;

  return jsonb_build_object('score', sc, 'correct', correct, 'submission_id', sub_id);
end; $$;

revoke execute on function submit_answer(uuid, jsonb) from anon, public;
grant  execute on function submit_answer(uuid, jsonb) to authenticated;
