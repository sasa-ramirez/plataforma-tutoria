# Base de datos — Supabase / Postgres

Esquema relacional con **Row Level Security** en todas las tablas. El SQL
real y comentado está en `supabase/migrations/`, un archivo por cambio,
numerados en orden (`0001` a `0035` al momento de escribir esto). Cada
archivo tiene un comentario arriba explicando qué hace y por qué — es la
fuente de verdad; esta página es un mapa para no tener que leer los 35.

## Cómo aplicar las migraciones

En un proyecto nuevo de Supabase: SQL Editor → pega y ejecuta cada archivo
**en orden**, del `0001` al más reciente. Todas son idempotentes (`create
table if not exists`, `drop policy if exists` antes de crearla, etc.), así
que si por error se corre una dos veces no rompe nada.

## Mapa de tablas por área

### Núcleo (cursos, tareas, ejercicios) — `0001`, `0007`, `0012`, `0016`
| Tabla | Qué guarda |
|---|---|
| `profiles` | Datos públicos + `role`, `is_admin`, `is_coordinator`, XP, racha |
| `courses` | Cursos de un profesor; `join_code`; `schedule` (texto libre); `subject_id` (opcional, catálogo) |
| `enrollments` | Inscripción estudiante↔curso |
| `assignments` | Tareas: ventana de tiempo, dificultad, `is_exam`, `time_limit_min`, `language` |
| `exercises` | Ejercicios de una tarea o de práctica libre; `type` = código/opción múltiple/numérica/abierta |
| `exercise_answers` | La respuesta correcta (opción múltiple/numérica) o la rúbrica (abierta) — nunca visible al estudiante por RLS |
| `submissions` | Entregas: código/respuesta, `score`, `status`, tiempos, y ahora `teacher_comment`/`teacher_graded_at`/`teacher_graded_by` (nota manual, `0031`) |
| `ai_feedback` | Feedback estructurado de la IA por submission (1:1) |
| `exam_logs` | Eventos anti-trampa, append-only |
| `practice_sessions` | Progreso de práctica libre |

### Coordinación y catálogo — `0011`, `0013`–`0020`, `0032`
| Tabla | Qué guarda |
|---|---|
| `faculties`, `careers`, `subjects` | Catálogo Facultad→Carrera→Asignatura, precargado con la Universidad de La Guajira |
| — | Coordinación no tiene tablas propias: son funciones `security definer` (`coord_*`) que leen las tablas de arriba con permisos ampliados |
| — | Cuentas sin confirmar: tampoco es tabla propia, lee `auth.users` vía `coord_unconfirmed_accounts()` |

### Tablero en vivo y clase — `0008`, `0009`
| Tabla | Qué guarda |
|---|---|
| `boards` | Un tablero por curso; `is_live`/`live_started_at` para la clase en vivo |
| `board_strokes` | Trazos del lienzo (para el que entra a mitad de clase) |
| `notifications` | Notificaciones dentro de la app (todas: tarea nueva, calificado, clase en vivo, recordatorio, cambios de grupo...) |

### Horario por votación — `0015`, `0021`
| Tabla | Qué guarda |
|---|---|
| `schedule_options` | Opciones de horario que propone el tutor |
| `schedule_votes` | Votos de los estudiantes |
| — | El horario "acordado" vive en `courses.schedule` (texto, un horario por línea) |

### Documentos institucionales — `0022`–`0027`
| Tabla | Qué guarda |
|---|---|
| `tutoring_sessions` | Asistencia de tutorías (fecha, tema, asistentes) |
| `periodic_reports` | Informes periódicos (BS-F-17), con foto de evidencia |
| `actas` | Actas de reunión (AD-F-01) |
| — | Las plantillas .docx/.xlsx reemplazables viven en el bucket `document-templates`, no en una tabla |

### Notificaciones push y recordatorios — `0010`, `0028`–`0030`
| Tabla | Qué guarda |
|---|---|
| `push_subscriptions` | Suscripción Web Push por dispositivo (endpoint, claves) |
| `assignment_reminders_sent` | Control de qué recordatorio ya se mandó (para no repetir) |
| — | `notifications.pushed_at` marca qué notificación ya se intentó mandar por push (modelo de sondeo, ver `ARCHITECTURE.md`) |

### Materiales y quiz en vivo — `0034`, `0035`
| Tabla | Qué guarda |
|---|---|
| `course_materials` | PDF/Word/PowerPoint o enlaces que sube el tutor |
| `quiz_sessions` | Una sesión de quiz en vivo: sobre qué tarea, modo, estado, pregunta actual |
| `quiz_participants` | Quién se unió, su puntaje, su propio avance |
| `quiz_answers` | Cada respuesta individual (para revisar después si hace falta) |

## Enums / valores fijos

- `user_role`: `student | teacher`
- `difficulty`: `beginner | easy | medium | hard`
- `prog_language`: `pseint | java | python | logic` (`logic` = "no es
  código"; si el curso tiene asignatura, se muestra esa en vez de "Lógica")
- `assignment_status`: `draft | open | closed`
- `submission_status`: `draft | submitted | grading | graded | error`
- `exercise.type`: `code | multiple_choice | numeric | open`
- `exam_event`: `tab_blur | tab_focus | window_hidden | window_visible | paste | copy | fullscreen_exit`
- `quiz_sessions.mode`: `sync | pace`
- `quiz_sessions.status`: `lobby | active | ended`

## Patrones de RLS que se repiten

- **Lectura por rol**: casi toda tabla tiene una política "el dueño puede
  todo" (`owns_course(course_id)`) y otra "el inscrito puede leer"
  (`is_enrolled(course_id)`).
- **Solo lectura + RPC**: en las tablas donde importa que nadie pueda
  hacer trampa (`submissions.score`, todo `quiz_*`, `profiles.xp`/`streak`),
  **no hay política de escritura para `authenticated`** — todo pasa por una
  función `security definer` que valida antes de tocar la fila. Ver
  [`ARCHITECTURE.md`](./ARCHITECTURE.md#3-seguridad-y-permisos).
- **Storage por carpeta**: en los buckets privados, el primer segmento de
  la ruta del archivo es el `course_id`, y la política usa
  `storage.foldername(name)[1]` para decidir quién puede leer/escribir.

Funciones de ayuda más usadas en las políticas: `is_teacher(uid)`,
`owns_course(course_id)`, `is_enrolled(course_id)`, `is_admin(uid)`,
`is_coordinator(uid)`, `can_view_reports()` (coordinador o admin).

## Pendiente

Nunca se hizo una auditoría sistemática de RLS — no hay pruebas
automáticas que confirmen que un estudiante no puede leer datos de un
curso ajeno. Está en el roadmap.
