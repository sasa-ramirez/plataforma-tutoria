-- ============================================================
-- 0033 — Arregla: las entregas dejaron de verse en el panel del tutor
-- La migración 0031 agregó submissions.teacher_graded_by con FK a profiles.
-- Con dos relaciones entre submissions y profiles (student_id y
-- teacher_graded_by), PostgREST ya no sabe cuál usar en `profiles(full_name)`
-- y esas consultas fallan (PGRST201): el panel mostraba "Aún no hay entregas"
-- y la actividad reciente del inicio del tutor no cargaba. Los datos nunca se
-- perdieron. Se quita la FK (la columna se queda como uuid simple).
-- Idempotente.
-- ============================================================

alter table submissions drop constraint if exists submissions_teacher_graded_by_fkey;

-- Que la API vea el cambio de inmediato.
notify pgrst, 'reload schema';
