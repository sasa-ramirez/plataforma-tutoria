-- ============================================================
-- 0026 — Plantillas de documentos reemplazables (BS-F-17, AD-F-01)
-- Hasta ahora el .docx oficial venía "quemado" en el código: si la
-- universidad cambia el formato, hay que editar código y desplegar.
-- Con esto, coordinación puede subir el Word nuevo (ya etiquetado con
-- los campos {tag}) desde la app, sin tocar código. Si no hay ninguno
-- subido, la app sigue usando la plantilla incluida de fábrica.
-- Aditivo. Idempotente.
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'document-templates', 'document-templates', false, 5242880,
  array['application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Cualquier cuenta con sesión puede leer (los tutores las necesitan para
-- generar sus informes/actas); solo coordinación puede reemplazarlas.
drop policy if exists "doc templates read" on storage.objects;
create policy "doc templates read" on storage.objects for select
  using (bucket_id = 'document-templates' and auth.uid() is not null);

drop policy if exists "doc templates write" on storage.objects;
create policy "doc templates write" on storage.objects for all
  using (bucket_id = 'document-templates' and can_view_reports())
  with check (bucket_id = 'document-templates' and can_view_reports());
