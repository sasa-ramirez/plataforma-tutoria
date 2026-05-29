# 🎓 Plataforma de Tutoría

Plataforma educativa **mobile-first** para aprender programación básica (PSeInt, Java, lógica). Los profesores crean tareas, los estudiantes resuelven ejercicios en un editor real, y una IA revisa, explica y califica automáticamente.

> Inspiración visual: Duolingo · Notion · HackerRank · Linear · Discord.

## ✨ Características

- 👩‍🏫 **Profesor**: cursos, tareas con ventana de tiempo, modo examen, entregas, estadísticas.
- 🧑‍🎓 **Estudiante**: resolver ejercicios, feedback de IA, práctica libre, racha y XP.
- 🤖 **IA (OpenRouter)**: revisa el código, detecta errores, sugiere mejoras y califica 1–100 en JSON.
- 🛡️ **Modo examen**: registra (sin bloquear) cambios de pestaña, minimizado y copy/paste.
- 📱 **Mobile-first**: bottom-nav, editor fullscreen, touch targets grandes, PWA en Android.

## 🧱 Stack

| Capa | Tecnología |
|------|-----------|
| Frontend | React 18, Vite, TypeScript, TailwindCSS, shadcn/ui, Framer Motion |
| Estado | Context API (sesión/rol) + TanStack Query (datos) |
| Editor | Monaco Editor |
| Backend | Supabase (Auth, Postgres + RLS, Realtime, Storage, Edge Functions) |
| IA | OpenRouter (vía Edge Function, key oculta) |
| Hosting | Vercel + Supabase |

## 🚀 Puesta en marcha

```bash
# 1. Dependencias
npm install

# 2. Variables de entorno
cp .env.example .env   # rellena VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY

# 3. Desarrollo
npm run dev
```

### Supabase

```bash
# Aplica el esquema + RLS
supabase db push   # o pega supabase/migrations/0001_init.sql en el SQL Editor

# IA: despliega la función y configura la key
supabase functions deploy ai-review
supabase secrets set OPENROUTER_API_KEY=sk-or-...
supabase secrets set OPENROUTER_MODEL=anthropic/claude-3.5-sonnet
```

## 📁 Estructura

```
plataforma_tutoria/
├─ docs/                    # ARCHITECTURE · DATABASE · ROADMAP
├─ supabase/
│  ├─ migrations/0001_init.sql   # esquema + RLS
│  └─ functions/ai-review/       # Edge Function OpenRouter
├─ src/
│  ├─ components/
│  │  ├─ ui/              # primitivas shadcn (button, card, input…)
│  │  ├─ common/          # StatCard, EmptyState, Spinner, PageHeader
│  │  ├─ layout/          # AppLayout (bottom-nav + sidebar)
│  │  ├─ auth/            # ProtectedRoute
│  │  └─ dashboard/       # Student/Teacher dashboards
│  ├─ context/            # AuthContext
│  ├─ pages/              # auth/, Dashboard, Courses, Practice, Profile
│  ├─ lib/                # supabase, utils, constants
│  └─ types/              # tipos de dominio (DB)
└─ ...config
```

## 🗺️ Roadmap

El plan por fases está en [docs/ROADMAP.md](docs/ROADMAP.md). Estado actual: **Fase 0 — Fundaciones** completa (auth, ruteo por rol, layout mobile, dashboards, esquema + RLS, Edge Function de IA).

## 📦 Deploy en Vercel

1. Importa el repo en Vercel (framework: **Vite**).
2. Variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
3. Build: `npm run build` · Output: `dist`.
