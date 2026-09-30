# Arquitectura — Kódea (Plataforma de Tutoría)

> Para qué sirve la plataforma y qué puede hacer cada quien está en
> [`FUNCIONALIDADES.md`](./FUNCIONALIDADES.md). Este archivo es el "cómo está
> armada por dentro".

## 1. Visión general

```
┌──────────────────────────────────────────────────────────────────┐
│                         CLIENTE (PWA)                             │
│  React 18 + Vite + TS · TailwindCSS + shadcn/ui · Framer Motion   │
│  Monaco Editor · React Router · TanStack Query · Context API      │
│  Intérprete de PSeInt propio (corre en el navegador)              │
└───────────┬──────────────────────────┬────────────────┬──────────┘
            │ supabase-js (HTTPS/WS)   │ fetch (HTTPS)   │ fetch (HTTPS)
            ▼                          ▼                 ▼
┌───────────────────────┐  ┌───────────────────────┐  ┌──────────────────┐
│       SUPABASE          │  │  EDGE FUNCTIONS (Deno) │  │  Motores externos │
│ Auth · Postgres + RLS   │◄─┤  ai-review, ai-generate│  │  Wandbox / Judge0  │
│ Realtime · Storage      │  │  send-push (modo sondeo)│  │  (correr Python/  │
└───────────┬─────────────┘  └───────────┬────────────┘  │   Java)           │
            │                             │                └──────────────────┘
            │                             ▼
            │                  ┌─────────────────────┐
            │                  │   OpenRouter API      │
            │                  │  (modelo configurable)│
            │                  └─────────────────────┘
            │
            ▼
┌───────────────────────────┐        ┌────────────────────────────┐
│   GitHub Actions            │        │  Vercel                     │
│  ci.yml — lint+pruebas+build│        │  build + hosting de la SPA  │
│  push-poller.yml — cada 5min│        │  redeploy en cada push      │
│  backup.yml — respaldo diario│       └────────────────────────────┘
└───────────────────────────┘
```

**Decisión clave 1:** las llamadas a la IA (OpenRouter) se hacen desde
Edge Functions, nunca desde el navegador — la API key nunca viaja al
cliente, y así se controla el costo y el prompt desde el servidor.

**Decisión clave 2 (la más importante de toda la sesión de push):** este
proyecto de Supabase **no puede llamar a sus propias Edge Functions desde
la base de datos**. `pg_net` (la extensión de Postgres que hace peticiones
HTTP async) resuelve dominios externos sin problema (`httpbin.org` funciona)
pero **no resuelve el propio dominio `*.supabase.co` del proyecto** — es
una restricción de la plataforma, no una mala configuración nuestra
(confirmado con `net._http_response.error_msg = "Couldn't resolve host
name"`, mientras un `nslookup` externo sí resuelve el dominio sin
problema). Tampoco existe `supabase_functions.http_request()` en este
proyecto (por eso el panel de "Database Webhooks" ni siquiera aparece en el
dashboard). La solución fue mover el disparo **fuera** de la base de
datos: un workflow de GitHub Actions (`push-poller.yml`) llama por `curl`
cada 5 minutos a la función `send-push`, que en modo "sondeo" busca en
`notifications` lo que falte por mandar y lo manda. Si algún día se migra
a un proyecto de Supabase donde `pg_net` sí resuelva su propio dominio,
este rodeo deja de ser necesario — pero mientras tanto, es la única forma
que funciona en este proyecto.

## 2. Capas del frontend

| Capa | Responsabilidad | Tecnología |
|------|-----------------|------------|
| **UI primitives** | Botones, inputs, cards, dialogs accesibles | shadcn/ui (Radix) |
| **Componentes de dominio** | CodeEditor, AIFeedbackPanel, QuizHostView... | React + Framer Motion |
| **Pantallas (routes)** | Composición por rol | React Router v6 |
| **Estado de servidor** | Cache, refetch, mutaciones, Realtime | TanStack Query + Supabase Realtime |
| **Estado global de app** | Sesión, perfil, tema | Context API (`AuthContext`) |
| **Acceso a datos** | Queries/RPC tipados a Supabase | hooks `use*` (`src/hooks`) + `src/services` |

**Regla:** los componentes nunca llaman a Supabase directamente. Pasan por
hooks (`useAssignments`, `useQuiz`, `useCoordinator`...) que envuelven
funciones tipadas en `src/services`.

**Regla de bundle:** cualquier librería pesada u opcional (exceljs, xlsx,
docx-preview, docxtemplater, qrcode, las plantillas .docx en base64) se
carga con `import()` dinámico, nunca con un `import` estático arriba del
archivo — así el que nunca exporta a Excel no descarga esas 800 KB. Vite
las separa solas en su propio "chunk". Esto se rompió sin querer una vez
esta sesión (un import estático de `exportTutoring` en `ScheduleCard.tsx`)
y se detectó revisando el resultado de `npm run build`.

## 3. Seguridad y permisos

- **RLS en todas las tablas.** El cliente solo tiene la `anon key`; cada
  fila se filtra por `auth.uid()` y rol, usando funciones de ayuda:
  `is_teacher()`, `owns_course(course_id)`, `is_enrolled(course_id)`,
  `is_admin()`, `is_coordinator()`.
- **Patrón "solo lectura + RPC" para todo lo que se pueda hacer trampa.**
  En `submissions` (notas), `quiz_participants`/`quiz_sessions` (puntajes
  del quiz), y `profiles.xp`/`streak`, las tablas **no tienen política de
  escritura para `authenticated`** — todo cambio pasa por una función
  `security definer` (`teacher_set_grade`, `quiz_submit_answer`,
  `quiz_next`...) que valida todo antes de escribir. Así un estudiante no
  puede, desde la consola del navegador, ponerse `score = 100` a mano.
  Esto se descubrió como un hueco real en `submissions` (migración 0031) y
  se corrigió con un disparador (`protect_submission_grades`) que además
  evita que la IA le pise la nota a un tutor que ya calificó.
- **OpenRouter key** solo en secretos de la Edge Function
  (`OPENROUTER_API_KEY`), nunca en el cliente.
- **Modo examen**: los eventos anti-trampa (salir de pantalla, pegar texto)
  se registran, no bloquean — es indicio, no prueba. El listener de "pegar"
  escucha en fase de **captura** (`addEventListener(..., true)`) porque
  Monaco Editor intercepta el evento en su textarea interno antes de que
  llegue a un listener normal en `document`.
- **Storage privado por curso**: los buckets (`course-materials`,
  `report-photos`, `document-templates`) usan el primer segmento de la
  ruta del archivo (`<course_id>/...`) para decidir con RLS quién puede
  leer/escribir, vía `storage.foldername(name)[1]`.

## 4. Flujo "resolver tarea con IA" (código)

1. Estudiante abre la tarea → se valida ventana de tiempo en cliente **y**
   con un disparador en la base de datos (`enforce_assignment_deadline`),
   para que no sirva de nada manipular el reloj del navegador.
2. Escribe en Monaco. Si es examen, `useExamGuard` registra blur,
   visibilitychange, paste.
3. Al enviar → `submission` pasa a `submitted`.
4. El cliente invoca `ai-review` con el `submission_id`.
5. La función arma el prompt (prioriza si el código *funciona* sobre
   errores menores de estilo — un ajuste explícito que se hizo esta
   sesión), llama a OpenRouter, guarda `ai_feedback`, actualiza
   `submission.score` y el estado a `graded`.
6. El estudiante ve el feedback animado. Si el tutor corrige la nota
   después, esa corrección queda como la nota final (ver sección 3).

## 5. Ejecución de código (Python, Java, PSeInt)

- **PSeInt**: intérprete propio en `src/lib/pseint.ts`, corre 100% en el
  navegador. Ver [`FUNCIONALIDADES.md`](./FUNCIONALIDADES.md#7-el-intérprete-de-pseint).
- **Python/Java**: van a motores externos gratis (**Wandbox** como
  primario, **Judge0** como respaldo automático si Wandbox está caído o
  saturado — antes solo había uno y se caía, ahora hay dos).
- **Consola interactiva** para los tres lenguajes: cuando el programa pide
  un dato (`Leer`/`input()`/`Scanner`), se pausa y aparece una casilla para
  escribirlo. Para Python y Java (que no se pueden "pausar" de verdad
  porque corren en un servidor ajeno) se logra con un parche: se reemplaza
  `input()`/`System.in` por una versión que repite en pantalla lo que se
  escribió, y se re-ejecuta el programa completo con las respuestas
  acumuladas cada vez que llega una nueva — el "fin de la entrada"
  (`EOFError` / `NoSuchElementException`) se interpreta como "falta un
  dato", no como un error del estudiante.

## 6. Quiz en vivo — cómo está pensado para no romperse

- Reutiliza `exercises`/`exercise_answers` como banco de preguntas — un
  quiz **no** tiene su propio banco aparte.
- Dos modos comparten toda la lógica de puntaje y marcador; solo cambia
  quién decide cuándo avanza la pregunta (`quiz_sessions.mode`:
  `'sync'` = el tutor, `'pace'` = cada estudiante solo). Así, si algún día
  se quiere ofrecer los dos a la vez, no hay que construir dos sistemas.
- Todo el estado (quién se unió, en qué pregunta va, el puntaje) se
  actualiza en vivo con **Realtime sobre las tablas** (`postgres_changes`),
  el mismo mecanismo que ya usaba el tablero de clase — no se inventó un
  canal de mensajes aparte.
- El orden de las preguntas lo decide `row_number() over (order by
  order_index, created_at)` **tanto en el servidor (SQL) como en el
  cliente** — tiene que ser exactamente el mismo criterio de orden en los
  dos lados, o el cliente cree que está en la pregunta 3 y el servidor en
  la 4, y la respuesta se rechaza.

## 7. Mobile-first

- Diseño base = móvil (`< 640px`); `sm/md/lg` solo añaden.
- Editor de código va a fullscreen en móvil con barra de símbolos flotante
  (para escribir `{`, `}`, `;` sin pelear con el teclado del celular).
- Bottom-tab-bar en móvil, sidebar en desktop.
- PWA instalable, pensada para Android.

## 8. Calidad, respaldo y monitoreo

- **Pruebas**: Vitest, ~86 pruebas sobre la lógica que no depende de la
  base de datos (el intérprete de PSeInt, el ejecutor de código, el
  auto-etiquetado de plantillas, exportación a Excel, detección de correos
  mal escritos, insignias por materia...). `npm test`.
- **CI** (`.github/workflows/ci.yml`): en cada push a `main` y cada Pull
  Request corre lint + pruebas + build. Antes de esto, cualquier error se
  enteraba directo en producción.
- **Respaldo diario** (`.github/workflows/backup.yml`): copia cifrada
  (AES-256) de toda la base de datos (tablas de la app + cuentas de
  `auth.users`), sube como artefacto de GitHub Actions, se guarda 60 días.
  El repo es público, por eso va cifrado. **No** incluye los archivos de
  Storage (fotos, materiales subidos) — esos habría que respaldarlos
  aparte si hace falta.
- **Sentry** (`src/lib/sentry.ts`): opcional — solo se activa si existe
  `VITE_SENTRY_DSN`. Verificado que si esa variable no está, Sentry queda
  completamente fuera del build final (0 costo), no solo apagado en
  tiempo de ejecución.

## 9. Cosas que NO son obvias y vale la pena recordar

- **`ALTER DATABASE ... SET app.<clave> = '...'`** solo aplica a
  conexiones *nuevas* — no a una pestaña del SQL Editor que ya estaba
  abierta. Causa confusiones de "por qué no ve el valor" si no se sabe.
- **El Personal Access Token de Supabase** para el CLI necesita el preset
  "Acceso completo" al crearlo — el preset por defecto es "Sin acceso" y
  da un 403 al desplegar, incluso siendo el dueño de la cuenta.
- **El pooler de conexión** (`Session pooler`, no la conexión directa) es
  el que hay que usar para `SUPABASE_DB_URL` en el respaldo desde GitHub
  Actions.
