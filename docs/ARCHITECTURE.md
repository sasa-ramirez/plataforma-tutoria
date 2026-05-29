# Arquitectura — Plataforma de Tutoría

> Plataforma educativa mobile-first para programación básica (PSeInt, Java, lógica).
> Profesores crean tareas, estudiantes resuelven, la IA revisa y califica.

---

## 1. Visión general

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENTE (PWA)                          │
│  React 18 + Vite + TS · TailwindCSS + shadcn/ui · Framer      │
│  Monaco Editor · React Router · TanStack Query · Context API  │
└───────────────┬───────────────────────────┬──────────────────┘
                │ supabase-js (HTTPS/WS)     │ fetch (HTTPS)
                ▼                            ▼
┌───────────────────────────┐   ┌──────────────────────────────┐
│         SUPABASE           │   │   EDGE FUNCTION (Deno)        │
│  · Auth (email/password)   │   │   /ai-review                 │
│  · Postgres + RLS          │◄──┤   Llama a OpenRouter,         │
│  · Realtime (exam logs)    │   │   guarda ai_feedback,        │
│  · Storage (avatares)      │   │   nunca expone la API key     │
└───────────────────────────┘   └──────────────┬───────────────┘
                                                │
                                                ▼
                                     ┌─────────────────────┐
                                     │   OpenRouter API     │
                                     │  (modelo configurable)│
                                     └─────────────────────┘
```

**Decisión clave:** la llamada a OpenRouter se hace desde una **Supabase Edge Function**, no desde el navegador. Así la API key nunca viaja al cliente y podemos controlar costos, rate-limit y prompts en el servidor.

---

## 2. Capas del frontend

| Capa | Responsabilidad | Tecnología |
|------|-----------------|------------|
| **UI primitives** | Botones, inputs, cards, dialogs accesibles | shadcn/ui (Radix) |
| **Componentes de dominio** | TaskCard, CodeEditor, AIFeedbackPanel, ExamGuard | React + Framer Motion |
| **Pantallas (routes)** | Composición por rol | React Router v6 |
| **Estado de servidor** | Cache, refetch, mutaciones | TanStack Query |
| **Estado global de app** | Sesión, perfil, tema, modo examen | Context API |
| **Acceso a datos** | Queries tipadas a Supabase | hooks `use*` + `src/services` |

**Regla:** los componentes nunca llaman a Supabase directamente. Lo hacen a través de hooks (`useAssignments`, `useSubmissions`...) que envuelven servicios tipados.

---

## 3. Seguridad

- **RLS en todas las tablas.** El cliente usa la `anon key`; cada fila se filtra por `auth.uid()` y rol.
- **Rol del usuario** vive en `profiles.role` y se consulta vía función `is_teacher()` / `is_enrolled()` en políticas.
- **OpenRouter key** solo en variables de entorno de la Edge Function (`OPENROUTER_API_KEY`).
- **Modo examen**: los eventos anti-trampa se registran (no bloquean). El registro es append-only para el estudiante.

---

## 4. Flujo "resolver tarea con IA"

1. Estudiante abre tarea → se valida ventana de tiempo (open/close) en cliente **y** RLS.
2. Escribe código en Monaco. Si la tarea es modo examen, `ExamGuard` registra `blur`, `visibilitychange`, `paste`.
3. Al enviar → se crea `submission` (estado `submitted`).
4. El cliente invoca la Edge Function `ai-review` con el `submission_id`.
5. La función arma el prompt, llama a OpenRouter, parsea el JSON, guarda `ai_feedback` y actualiza `submission.score` + estado `graded`.
6. El cliente recibe el feedback (Realtime o refetch) y lo muestra con animación.

---

## 5. Mobile-first

- **Breakpoints**: diseño base = móvil (`< 640px`). `sm/md/lg` solo añaden.
- **Editor**: en móvil va a fullscreen con toolbar flotante (FAB) y botón "Expandir".
- **Navegación**: bottom-tab-bar en móvil, sidebar en desktop.
- **Touch targets** mínimos 44px. Tipografía legible (16px base para evitar zoom en iOS).
- **PWA**: instalable, optimizada para Android.

Ver [DATABASE.md](./DATABASE.md) para el esquema y [ROADMAP.md](./ROADMAP.md) para el plan de entrega.
