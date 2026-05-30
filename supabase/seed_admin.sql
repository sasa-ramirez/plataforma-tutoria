-- ============================================================
-- Seeder de ADMIN — promueve un usuario a administrador.
-- Ejecutar UNA vez en el SQL Editor de Supabase.
-- Requisitos: haber corrido 0001_init.sql y 0002_admin_roles.sql,
-- y que el usuario YA se haya registrado en la app (existe su profile).
--
-- Corre como rol 'postgres' (el del SQL Editor), por eso el trigger
-- protect_profile_role permite el cambio de rol/privilegios.
-- ============================================================

update profiles
   set is_admin = true,
       role = 'teacher'
 where email = 'samuvento2018@gmail.com';   -- 👈 cambia el correo si hace falta

-- Verificación (debe mostrar is_admin = true, role = teacher)
select email, role, is_admin
  from profiles
 where email = 'samuvento2018@gmail.com';
