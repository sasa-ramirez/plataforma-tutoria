# Base de datos — Supabase / Postgres

Esquema relacional con **Row Level Security** en todas las tablas, timestamps y soft-delete (`deleted_at`).

## Diagrama (ER simplificado)

```
auth.users ──1:1── profiles
                      │
        ┌─────────────┼──────────────────┐
        │ (teacher)   │ (student)         │
        ▼             ▼                   │
     courses ──1:N── assignments          │
        │               │                 │
        │ 1:N           │ 1:N             │
        ▼               ▼                 │
   enrollments      exercises             │
   (student↔course)     │                 │
                        │ 1:N             │
                        ▼                 │
                   submissions ◄──────────┘ (student)
                        │ 1:1
                        ▼
                   ai_feedback

   submissions ──1:N── exam_logs
   profiles    ──1:N── practice_sessions ──N:1── exercises
```

## Tablas

| Tabla | Descripción | Claves |
|-------|-------------|--------|
| `profiles` | Datos públicos + `role` (`student`/`teacher`), streak, avatar | `id` = `auth.users.id` |
| `courses` | Cursos creados por un profesor; `join_code` para inscripción | `teacher_id → profiles` |
| `enrollments` | Inscripción estudiante↔curso | `(course_id, student_id)` único |
| `assignments` | Tareas: ventana de tiempo, dificultad, modo examen, puntos | `course_id → courses` |
| `exercises` | Ejercicios dentro de una tarea **o** de práctica libre | `assignment_id?`, `is_practice` |
| `submissions` | Envíos de código del estudiante; estado y score | `exercise_id`, `student_id` |
| `ai_feedback` | Respuesta estructurada de la IA por submission | `submission_id` 1:1 |
| `exam_logs` | Eventos anti-trampa (blur, paste, hidden) | `submission_id`, `event_type` |
| `practice_sessions` | Sesiones de práctica libre y progreso | `student_id`, `exercise_id` |

## Enums

- `user_role`: `student | teacher`
- `difficulty`: `beginner | easy | medium | hard`
- `prog_language`: `pseint | java | python | logic`
- `assignment_status`: `draft | open | closed`
- `submission_status`: `draft | submitted | grading | graded | error`
- `exam_event`: `tab_blur | tab_focus | window_hidden | window_visible | paste | copy | fullscreen_exit`

## Políticas RLS (resumen)

- **profiles**: todos leen perfiles básicos; cada quien edita el suyo.
- **courses**: el profesor dueño hace CRUD; estudiantes inscritos leen.
- **enrollments**: el estudiante se inscribe a sí mismo (con `join_code`); el profesor del curso ve a sus inscritos.
- **assignments/exercises**: profesor dueño CRUD; estudiante inscrito lee solo si `status='open'` o ya pasó.
- **submissions**: estudiante CRUD de las suyas; profesor del curso lee las de su curso.
- **ai_feedback**: lectura para dueño de la submission y profesor del curso; escritura solo vía service-role (Edge Function).
- **exam_logs**: estudiante inserta los suyos (append-only); profesor del curso lee.
- **practice_sessions**: solo el dueño.

Funciones de ayuda en SQL: `is_teacher(uid)`, `owns_course(course_id)`, `is_enrolled(course_id)`.

El SQL completo está en [`supabase/migrations/0001_init.sql`](../supabase/migrations/0001_init.sql).
