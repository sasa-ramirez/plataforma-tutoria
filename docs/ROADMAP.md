# Roadmap de implementación

Entrega por módulos. Cada hito deja la app en estado ejecutable.

## ✅ Fase 0 — Fundaciones (este commit)
- [x] Arquitectura, esquema DB + RLS, roadmap
- [x] Scaffolding Vite + React + TS + Tailwind + shadcn
- [x] Cliente Supabase + tipos
- [x] AuthContext + ruteo protegido por rol
- [x] Layout mobile-first (bottom-nav + sidebar) + tema
- [x] Primitivas UI base + tokens de diseño

## 🔜 Fase 1 — Autenticación y perfiles
- [ ] Pantallas login / registro (elige rol)
- [ ] Onboarding y edición de perfil + avatar (Storage)
- [ ] Guard de sesión, refresh, logout

## ✅ Fase 2 — Cursos e inscripción
- [x] Profesor: crear curso (color, descripción), ver/copiar `join_code`
- [x] Estudiante: unirse por código, lista de cursos inscritos
- [x] Detalle de curso + lista de estudiantes (profesor)
- [x] Empty states + skeletons + toasts
- [x] Capa de datos: `services/courses` + hooks TanStack Query

## ✅ Fase 3 — Tareas y ejercicios
- [x] CRUD de tareas (ventana de tiempo, dificultad, modo examen, puntos)
- [x] Editor de ejercicios con starter/solution
- [x] Bloqueo automático por fecha (UI `isAssignmentOpen` + RLS)
- [x] Página de detalle de tarea con lista de ejercicios

## ✅ Fase 4 — Editor de código (Monaco)
- [x] `CodeEditor` responsive + toolbar + fullscreen
- [x] FAB de enviar, control de fuente, tema de marca
- [x] Autoguardado de borrador (debounced)
- [x] Pantalla de resolución dedicada (sin layout, inmersiva)

## ✅ Fase 5 — IA (OpenRouter)
- [x] Edge Function `ai-review` (prompt + parseo JSON tolerante)
- [x] `AIFeedbackPanel` animado (score circular, errores, sugerencias, fortalezas)
- [x] Estados: enviando / calificando / calificado / error
- [x] Revelar solución tras calificar

## ✅ Fase 6 — Modo examen
- [x] `useExamGuard` (blur, visibility, paste, copy)
- [x] Registro en `exam_logs` + advertencia visual (toast + banner)
- [ ] Vista del profesor: línea de tiempo de eventos (pendiente)

## ✅ Fase 7 — Práctica libre
- [x] Catálogo de ejercicios "Practicar" (datos reales)
- [x] Resolver con feedback IA + ver solución
- [ ] Progreso persistente en `practice_sessions` (pendiente)

## ✅ Fase 8 — Dashboards (datos reales)
- [x] Estudiante: completados, pendientes (reales), mis cursos, tareas pendientes
- [x] Profesor: estudiantes, cursos, por calificar, entregas, actividad reciente
- [x] `services/dashboard` + hooks con TanStack Query + skeletons
- [ ] Gráficas (recharts) + realtime (mejora futura)

## Fase 9 — Pulido y PWA
- [ ] Code-splitting (lazy Monaco), PWA instalable
- [ ] Optimización Android, deploy Vercel + Supabase
