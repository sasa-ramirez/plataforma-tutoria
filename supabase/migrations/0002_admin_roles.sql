-- ============================================================
-- 0002 — Admin + aprobación de profesores + blindaje de roles
-- Ejecutar DESPUÉS de 0001_init.sql. Idempotente.
-- ============================================================

-- ---------- profiles: bandera de admin ----------
alter table profiles add column if not exists is_admin boolean not null default false;

-- ---------- El registro SIEMPRE crea estudiantes ----------
-- (Nunca confiar en el rol que manda el cliente.)
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)),
    'student'                       -- forzado: el rol no lo decide el cliente
  );
  return new;
end; $$;

-- ---------- Blindaje: nadie cambia su propio rol/privilegio vía API ----------
-- Solo lo permiten roles de servidor (postgres / service_role) y las
-- funciones SECURITY DEFINER (que corren como 'postgres').
create or replace function protect_profile_role()
returns trigger language plpgsql as $$
begin
  if (new.role is distinct from old.role
      or new.is_admin is distinct from old.is_admin)
     and current_user not in ('postgres','supabase_admin','service_role') then
    raise exception 'No puedes cambiar tu rol o privilegios.';
  end if;
  return new;
end; $$;

drop trigger if exists t_protect_profile_role on profiles;
create trigger t_protect_profile_role before update on profiles
  for each row execute function protect_profile_role();

-- ---------- Helper is_admin ----------
create or replace function is_admin(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from profiles where id = uid and is_admin = true);
$$;

-- ============================================================
-- teacher_requests  (solicitudes para ser profesor)
-- ============================================================
create table if not exists teacher_requests (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,
  status      text not null default 'pending'
                check (status in ('pending','approved','rejected')),
  note        text,
  reviewed_by uuid references profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  reviewed_at timestamptz
);
-- Solo una solicitud pendiente por usuario
create unique index if not exists uniq_pending_teacher_request
  on teacher_requests(user_id) where status = 'pending';

alter table teacher_requests enable row level security;

drop policy if exists "tr insert own" on teacher_requests;
create policy "tr insert own" on teacher_requests for insert
  with check (user_id = auth.uid());

drop policy if exists "tr read own or admin" on teacher_requests;
create policy "tr read own or admin" on teacher_requests for select
  using (user_id = auth.uid() or is_admin(auth.uid()));
-- (los UPDATE solo se hacen vía la función review_teacher_request)

-- ---------- Aprobar / rechazar (solo admin) ----------
create or replace function review_teacher_request(req_id uuid, approve boolean)
returns void language plpgsql security definer set search_path = public as $$
declare target uuid;
begin
  if not is_admin(auth.uid()) then
    raise exception 'No autorizado: se requiere admin.';
  end if;

  select user_id into target from teacher_requests where id = req_id;
  if target is null then
    raise exception 'Solicitud no encontrada.';
  end if;

  update teacher_requests
     set status = case when approve then 'approved' else 'rejected' end,
         reviewed_by = auth.uid(),
         reviewed_at = now()
   where id = req_id;

  if approve then
    -- corre como 'postgres' (SECURITY DEFINER) → el trigger de blindaje lo permite
    update profiles set role = 'teacher' where id = target;
  end if;
end; $$;

-- ============================================================
-- BOOTSTRAP: conviértete en admin (cámbialo por tu correo)
-- ============================================================
-- Ejecuta esta línea UNA vez tras registrarte en la app:
--   update profiles set is_admin = true, role = 'teacher'
--   where email = 'samuvento2018@gmail.com';
