-- ============================================================
-- 0003 — Cerrar la lectura pública de perfiles (privacidad)
-- Antes: CUALQUIERA (incluso sin login) podía leer todos los
-- perfiles, con correos incluidos. Ahora solo:
--   · el dueño ve su propio perfil
--   · el profesor ve a SUS estudiantes inscritos
--   · el admin ve todos
-- Ejecutar DESPUÉS de 0001 y 0002. Idempotente.
-- ============================================================

-- ¿El profesor actual enseña a este estudiante? (SECURITY DEFINER
-- para evitar problemas de RLS al consultar enrollments/courses)
create or replace function teaches_student(student uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(
    select 1
      from enrollments e
      join courses c on c.id = e.course_id
     where e.student_id = student
       and c.teacher_id = auth.uid()
  );
$$;

-- Quitar la política abierta que filtraba todo
drop policy if exists "profiles read all" on profiles;

-- 1) Tu propio perfil
drop policy if exists "profiles read self" on profiles;
create policy "profiles read self" on profiles for select
  using (id = auth.uid());

-- 2) El profesor ve a los estudiantes inscritos en sus cursos
drop policy if exists "profiles read by teacher" on profiles;
create policy "profiles read by teacher" on profiles for select
  using (teaches_student(id));

-- 3) El admin ve todos los perfiles
drop policy if exists "profiles read by admin" on profiles;
create policy "profiles read by admin" on profiles for select
  using (is_admin(auth.uid()));

-- Nota: las políticas SELECT se combinan con OR; basta cumplir una.
-- (La política de UPDATE "profiles update own" de 0001 sigue vigente,
--  y el trigger protect_profile_role impide cambiar rol/privilegios.)
