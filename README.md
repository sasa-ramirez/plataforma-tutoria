# 🎓 Kódea — Plataforma de Tutoría

Plataforma **mobile-first** para la tutoría académica de la Universidad de
La Guajira. Nació para programación (PSeInt, Java, Python) pero hoy sirve
para **cualquier materia**: los tutores crean tareas y materiales, los
estudiantes resuelven y estudian, la IA revisa y califica, y coordinación
tiene visión y control de todo. También genera los formatos institucionales
oficiales (informes, actas) en Word, listos para firmar.

> La guía completa de qué hace cada parte está en
> [`docs/FUNCIONALIDADES.md`](docs/FUNCIONALIDADES.md) — léela primero si
> vas a retomar el proyecto después de un tiempo.

## ✨ Lo que hace hoy

- 👩‍🏫 **Tutor**: cursos, tareas (código/opción múltiple/numérica/abierta),
  modo examen, calificación con IA + nota manual, materiales educativos,
  quiz en vivo con QR, tablero de clase en vivo, horario, informes y actas
  oficiales en Word, asistencia de tutorías.
- 🧑‍🎓 **Estudiante**: resolver ejercicios con feedback de IA, ejecutar
  PSeInt/Java/Python de verdad (consola interactiva), práctica libre,
  racha y XP, notificaciones (dentro de la app y con el celular cerrado).
- 🧑‍💼 **Coordinador**: ve y administra todos los cursos, cuentas sin
  confirmar, reportes exportables, plantillas de documentos.
- 🤖 **IA (OpenRouter)**: revisa código, califica con rúbrica, genera
  ejercicios de práctica — siempre desde el servidor, la key nunca viaja
  al navegador.
- 🎮 **Quiz en vivo**: los estudiantes entran con un QR, dos modos —
  sincronizado (todos la misma pregunta, como Kahoot) o a su ritmo (cada
  quien solo, como Quizizz).
- 🛡️ **Modo examen**: registra (sin bloquear) cambios de pestaña,
  minimizado y pegado de texto.
- 📱 **Mobile-first**: bottom-nav, editor fullscreen, PWA en Android.

## 🧱 Stack

| Capa | Tecnología |
|------|-----------|
| Frontend | React 18, Vite, TypeScript, TailwindCSS, shadcn/ui, Framer Motion |
| Estado | Context API (sesión/rol) + TanStack Query (datos, con Realtime) |
| Editor | Monaco Editor + intérprete de PSeInt propio |
| Backend | Supabase (Auth, Postgres + RLS, Realtime, Storage, Edge Functions) |
| IA | OpenRouter (vía Edge Function, key oculta) |
| Notificaciones push | Web Push + sondeo externo por GitHub Actions (ver `docs/ARCHITECTURE.md`) |
| Hosting | Vercel (app) + Supabase (backend) |
| CI/CD | GitHub Actions: pruebas en cada push, respaldo diario cifrado |

## 🚀 Puesta en marcha local

```bash
# 1. Dependencias
npm install

# 2. Variables de entorno
cp .env.example .env   # rellena VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY

# 3. Desarrollo
npm run dev

# 4. Pruebas
npm test
```

### Supabase

```bash
# Aplica TODAS las migraciones, en orden (no solo la primera)
# SQL Editor → pega y ejecuta cada archivo de supabase/migrations/, de 0001 al más reciente

# IA + notificaciones: despliega las Edge Functions y sus secretos
supabase functions deploy ai-review --no-verify-jwt
supabase secrets set OPENROUTER_API_KEY=sk-or-...
```

Guía completa: [`docs/SETUP_SUPABASE.md`](docs/SETUP_SUPABASE.md) ·
[`docs/DEPLOY.md`](docs/DEPLOY.md).

## 📁 Estructura

```
plataforma_tutoria/
├─ docs/                       # léelo antes de tocar código
│  ├─ FUNCIONALIDADES.md       # qué hace la plataforma, por rol (empieza aquí)
│  ├─ ARCHITECTURE.md          # cómo está armada, decisiones clave
│  ├─ DATABASE.md              # mapa de tablas y RLS
│  ├─ DEPLOY.md                # GitHub + Vercel + Supabase + Actions
│  ├─ SETUP_SUPABASE.md        # proyecto de Supabase desde cero
│  ├─ EMAIL_CONFIRMATION.md    # por qué a veces no llega el correo, y cómo arreglarlo
│  └─ ROADMAP.md               # qué está hecho, qué falta
├─ supabase/
│  ├─ migrations/               # 0001 → el más reciente, un archivo por cambio
│  └─ functions/                # ai-review, ai-generate, send-push
├─ .github/workflows/           # ci.yml, backup.yml, push-poller.yml
├─ src/
│  ├─ components/                # ui/ (shadcn), common/, layout/, auth/, quiz/, courses/, assignments/...
│  ├─ context/                   # AuthContext
│  ├─ pages/                     # una por ruta
│  ├─ hooks/                     # use* — envuelven services/ con TanStack Query
│  ├─ services/                  # llamadas tipadas a Supabase
│  ├─ lib/                       # supabase, utils, constants, pseint.ts (intérprete), qr.ts
│  └─ types/                     # tipos de dominio (DB)
└─ ...config
```

## 🗺️ Roadmap

Qué está hecho y qué sigue: [`docs/ROADMAP.md`](docs/ROADMAP.md).

## 📦 Deploy

Ya está en producción (Vercel + Supabase). Cada `git push` a `main`
redespliega Vercel solo y corre las pruebas en GitHub Actions. Detalle
completo, incluidos los secretos que hacen falta, en
[`docs/DEPLOY.md`](docs/DEPLOY.md).
