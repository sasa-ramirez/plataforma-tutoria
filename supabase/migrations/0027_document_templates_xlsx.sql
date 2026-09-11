-- ============================================================
-- 0027 — El bucket document-templates también guarda formatos en Excel
-- (seguimiento de notas, registro de asistencias) y las hojas de firma
-- planificada/ocasional (BS-F-51, BS-F-75), guardadas como referencia
-- del formato oficial vigente junto a BS-F-17/AD-F-01. Aditivo.
-- ============================================================

update storage.buckets
set allowed_mime_types = array[
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
]
where id = 'document-templates';
