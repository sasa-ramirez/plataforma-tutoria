-- ============================================================
-- 0006 — Arreglos: unirse por código + solicitud de profesor al registrarse
-- Ejecutar DESPUÉS de 0001-0005. Idempotente.
-- ============================================================

-- ---------- FIX 1: crear solicitud de profesor al registrarse ----------
-- Si el usuario eligió "Profesor" al registrarse (metadata role=teacher),
-- se crea una solicitud pendiente automáticamente (aparece en el panel admin).
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)),
    'student'   -- siempre estudiante; el rol no lo decide el cliente
  );

  if (new.raw_user_meta_data->>'role') = 'teacher' then
    insert into public.teacher_requests (user_id, note)
    select new.id, 'Solicitud creada al registrarse'
     where not exists (
       select 1 from public.teacher_requests
        where user_id = new.id and status = 'pending'
     );
  end if;

  return new;
end; $$;

-- ---------- FIX 2: unirse a un curso por código (sin chocar con RLS) ----------
-- El estudiante no puede leer un curso al que no pertenece (RLS), así que
-- esta función SECURITY DEFINER busca el curso por su código y lo inscribe.
create or replace function join_course_by_code(p_code text)
returns table (id uuid, title text)
language plpgsql security definer set search_path = public as $$
declare
  cid uuid;
  ctitle text;
begin
  select c.id, c.title into cid, ctitle
    from courses c
   where c.join_code = upper(trim(p_code))
     and c.deleted_at is null;

  if cid is null then
    raise exception 'No existe un curso con ese código.';
  end if;

  insert into enrollments (course_id, student_id)
  values (cid, auth.uid())
  on conflict (course_id, student_id) do nothing;

  return query select cid, ctitle;
end; $$;

revoke execute on function join_course_by_code(text) from anon, public;
grant execute on function join_course_by_code(text) to authenticated;
