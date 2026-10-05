-- ============================================================
-- 0040 — Módulo de estudio (parte 3): parcial simulado.
--
-- Kodea arma un parcial de opción múltiple a partir de las NOTAS por
-- tema de una materia (study_notes), no de los documentos completos.
-- Cada pregunta queda etiquetada con su tema: la parte 4 usa esa
-- etiqueta para decirle al estudiante en qué temas está flojo.
--
-- Todo es PRIVADO del estudiante. Las preguntas las inserta la Edge
-- Function (service-role); el estudiante solo contesta y finaliza.
-- Es práctica personal: la clave vive en la misma fila a propósito.
--
-- Aditivo. Idempotente. Ejecutar DESPUÉS de 0039.
-- ============================================================

create table if not exists study_exams (
  id             uuid primary key default gen_random_uuid(),
  space_id       uuid not null references study_spaces(id) on delete cascade,
  student_id     uuid not null references profiles(id) on delete cascade,
  title          text not null,
  difficulty     text not null check (difficulty in ('mixed', 'easy', 'medium', 'hard')),
  question_count int  not null check (question_count between 1 and 40),
  status         text not null default 'in_progress' check (status in ('in_progress', 'finished')),
  correct_count  int,                    -- se fija al finalizar
  created_at     timestamptz not null default now(),
  finished_at    timestamptz
);
create index if not exists idx_study_exams_space on study_exams(space_id, created_at desc);

create table if not exists study_exam_questions (
  id          uuid primary key default gen_random_uuid(),
  exam_id     uuid not null references study_exams(id) on delete cascade,
  student_id  uuid not null references profiles(id) on delete cascade,
  position    int  not null,
  topic       text not null,
  question    text not null,
  options     jsonb not null,
  correct     int  not null check (correct between 0 and 3),
  explanation text,
  selected    int check (selected between 0 and 3),
  answered_at timestamptz,
  unique (exam_id, position)
);
create index if not exists idx_study_exam_q_exam on study_exam_questions(exam_id, position);

alter table study_exams          enable row level security;
alter table study_exam_questions enable row level security;

-- Leer, contestar (update), finalizar y borrar: solo el dueño.
-- Insertar: solo la Edge Function (service-role ignora RLS), así un
-- estudiante no fabrica parciales a mano.
drop policy if exists "study exams read" on study_exams;
create policy "study exams read" on study_exams for select using (student_id = auth.uid());
-- (Sin política de update: el estado y el puntaje solo cambian por study_exam_finish.)
drop policy if exists "study exams update" on study_exams;
drop policy if exists "study exams delete" on study_exams;
create policy "study exams delete" on study_exams for delete using (student_id = auth.uid());

drop policy if exists "study exam q read" on study_exam_questions;
create policy "study exam q read" on study_exam_questions for select using (student_id = auth.uid());
drop policy if exists "study exam q update" on study_exam_questions;
create policy "study exam q update" on study_exam_questions for update
  using (student_id = auth.uid()) with check (student_id = auth.uid());

-- Al estudiante solo se le permite cambiar su respuesta, no la pregunta
-- ni la clave: un trigger revierte cualquier otro cambio.
create or replace function study_exam_q_only_answer()
returns trigger language plpgsql as $$
begin
  if current_user in ('postgres', 'supabase_admin', 'service_role') then
    return new;
  end if;
  new.exam_id     := old.exam_id;
  new.student_id  := old.student_id;
  new.position    := old.position;
  new.topic       := old.topic;
  new.question    := old.question;
  new.options     := old.options;
  new.correct     := old.correct;
  new.explanation := old.explanation;
  -- Con el parcial finalizado ya no se cambian respuestas.
  if exists (select 1 from study_exams e where e.id = old.exam_id and e.status = 'finished') then
    new.selected    := old.selected;
    new.answered_at := old.answered_at;
  else
    new.answered_at := now();
  end if;
  return new;
end; $$;

drop trigger if exists trg_study_exam_q_only_answer on study_exam_questions;
create trigger trg_study_exam_q_only_answer before update on study_exam_questions
  for each row execute function study_exam_q_only_answer();

-- Finalizar: el puntaje lo calcula el servidor, no el navegador.
create or replace function study_exam_finish(p_exam uuid)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_owner uuid;
  v_status text;
  v_correct int;
begin
  select student_id, status into v_owner, v_status from study_exams where id = p_exam;
  if v_owner is null or v_owner <> auth.uid() then raise exception 'Parcial no encontrado.'; end if;
  if v_status = 'finished' then
    select correct_count into v_correct from study_exams where id = p_exam;
    return v_correct;
  end if;

  select count(*) into v_correct from study_exam_questions
   where exam_id = p_exam and selected is not null and selected = correct;

  update study_exams
     set status = 'finished', correct_count = v_correct, finished_at = now()
   where id = p_exam;
  return v_correct;
end; $$;

revoke execute on function study_exam_finish(uuid) from anon, public;
grant  execute on function study_exam_finish(uuid) to authenticated;
