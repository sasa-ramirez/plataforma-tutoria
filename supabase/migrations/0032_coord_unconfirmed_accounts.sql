-- ============================================================
-- 0032 — Cuentas sin confirmar: el coordinador las ve y las confirma
-- Muchos correos institucionales bloquean el mensaje de confirmación de
-- Supabase, así que el estudiante se registra y nunca puede entrar. Estas
-- funciones dejan que el coordinador (o admin) vea esas cuentas, las confirme
-- sin abrir SQL, o borre las que tienen el correo mal escrito (solo si NO
-- están confirmadas, así que nunca tocan cuentas con datos).
-- Aditivo. Idempotente.
-- ============================================================

create or replace function coord_unconfirmed_accounts()
returns table (user_id uuid, email text, full_name text, created_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if not can_view_reports() then raise exception 'No autorizado'; end if;
  return query
    select u.id, u.email::text, p.full_name, u.created_at
      from auth.users u
      left join profiles p on p.id = u.id
     where u.email_confirmed_at is null
     order by u.created_at desc
     limit 300;
end; $$;

create or replace function coord_confirm_accounts(p_users uuid[])
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not can_view_reports() then raise exception 'No autorizado'; end if;
  update auth.users
     set email_confirmed_at = now()
   where id = any(p_users) and email_confirmed_at is null;
  get diagnostics n = row_count;
  return n;
end; $$;

create or replace function coord_delete_unconfirmed(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not can_view_reports() then raise exception 'No autorizado'; end if;
  delete from auth.users where id = p_user and email_confirmed_at is null;
  if not found then
    raise exception 'La cuenta no existe o ya está confirmada (no se puede borrar).';
  end if;
end; $$;

revoke execute on function coord_unconfirmed_accounts()      from anon, public;
revoke execute on function coord_confirm_accounts(uuid[])    from anon, public;
revoke execute on function coord_delete_unconfirmed(uuid)    from anon, public;
grant  execute on function coord_unconfirmed_accounts()      to authenticated;
grant  execute on function coord_confirm_accounts(uuid[])    to authenticated;
grant  execute on function coord_delete_unconfirmed(uuid)    to authenticated;
