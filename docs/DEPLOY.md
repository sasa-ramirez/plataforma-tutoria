# 🚀 Despliegue (GitHub + Vercel + Supabase)

El proyecto ya está en producción. Esto es para cuando haya que volver a
configurarlo desde cero (otro proyecto de Supabase, otra cuenta de Vercel)
o para entender qué toca dónde.

Orden: **1) GitHub → 2) Supabase → 3) Vercel → 4) GitHub Actions**.

---

## 1️⃣ GitHub

Repo: `sasa-ramirez/plataforma-tutoria`, rama `main`. Cada `git push` a
`main` dispara automáticamente:
- **Redeploy en Vercel** (webhook de Git integrado).
- **`ci.yml`**: lint + pruebas (`npm test`) + build. Si algo falla, sale ❌
  en el commit y llega un correo de GitHub — pero **no bloquea** el deploy
  de Vercel, que corre en paralelo. Sirve para enterarse rápido, no para
  frenar nada (a menos que se configure protección de rama con este check
  obligatorio).

## 2️⃣ Supabase

Ver [`SETUP_SUPABASE.md`](./SETUP_SUPABASE.md) para el paso a paso de un
proyecto nuevo. En resumen:
1. Crear proyecto en [supabase.com](https://supabase.com).
2. Aplicar **todas** las migraciones de `supabase/migrations/`, en orden
   (del `0001` al más reciente) — no solo la primera.
3. **Settings → API** → copiar `Project URL` y `anon public key`.
4. Desplegar las Edge Functions (`ai-review`, `ai-generate`, `send-push`) y
   configurar sus secretos — ver la tabla de abajo.

### Edge Functions y sus secretos

| Función | Qué hace | Secretos que necesita |
|---|---|---|
| `ai-review` | Califica una entrega con IA | `OPENROUTER_API_KEY`, `OPENROUTER_MODEL` |
| `ai-generate` | Genera un ejercicio de práctica con IA | mismos de arriba |
| `send-push` | Manda las notificaciones push pendientes (modo sondeo) | `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `PUSH_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY` (esta última ya viene sola en el entorno de la función) |

Desplegar una función:
```bash
npm i -g supabase          # una sola vez
supabase login              # o: export SUPABASE_ACCESS_TOKEN=... (ver nota abajo)
supabase link --project-ref TU-REF
supabase functions deploy ai-review --no-verify-jwt   # y ai-generate, send-push
supabase secrets set OPENROUTER_API_KEY=sk-or-...
```

> ⚠️ **El token de acceso del CLI necesita el preset "Acceso completo"** al
> crearlo en Account → Access Tokens. El preset por defecto es "Sin
> acceso" y el deploy falla con un 403, incluso siendo el dueño de la
> cuenta. Y las variables de entorno de la terminal (`export
> SUPABASE_ACCESS_TOKEN=...`) **no persisten entre sesiones** — hay que
> volver a ponerlas cada vez que se abre una terminal nueva.

## 3️⃣ Vercel

1. [vercel.com/new](https://vercel.com/new) → importar el repo.
2. Vercel detecta **Vite** solo. No cambiar nada del build.
3. **Environment Variables**:

| Nombre | Para qué |
|---|---|
| `VITE_SUPABASE_URL` | conexión a Supabase |
| `VITE_SUPABASE_ANON_KEY` | conexión a Supabase |
| `VITE_VAPID_PUBLIC_KEY` | notificaciones push (la pública, va en el cliente) |
| `VITE_SENTRY_DSN` | opcional — monitoreo de errores; si no está, Sentry no se incluye ni cuesta nada |

4. **Deploy**. En Supabase, **Authentication → URL Configuration** → poner
   el dominio de Vercel en *Site URL* y *Redirect URLs*, o el login en
   producción no funciona.

## 4️⃣ GitHub Actions (secretos del repo)

En Settings → Secrets and variables → Actions del repositorio:

| Secreto | Para qué workflow |
|---|---|
| `PUSH_WEBHOOK_SECRET` | `push-poller.yml` — el mismo valor que se configuró como secreto de la función `send-push` |
| `SUPABASE_DB_URL` | `backup.yml` — cadena de conexión completa (usar el **Session pooler**, no la conexión directa) con la contraseña de la base de datos ya puesta |
| `BACKUP_PASSPHRASE` | `backup.yml` — frase para cifrar el respaldo (generar con `openssl rand -base64 32` y guardarla en un lugar seguro **fuera** de GitHub) |

Los tres workflows:
- **`ci.yml`**: en cada push a `main` y cada Pull Request.
- **`push-poller.yml`**: cada 5 minutos, llama a `send-push`.
- **`backup.yml`**: cada día a las 3 a.m. (hora Colombia), copia cifrada de
  la base de datos, se guarda 60 días como artefacto descargable desde la
  pestaña Actions de esa corrida.

> Nota: GitHub puede desactivar los workflows programados (`schedule`) si
> el repositorio pasa unos ~60 días sin actividad (sin commits). Si el
> repo queda quieto mucho tiempo, revisar que sigan activos en Actions.

---

## ✅ Checklist para un proyecto nuevo desde cero
- [ ] Repo en GitHub
- [ ] Proyecto Supabase creado + **todas** las migraciones aplicadas en orden
- [ ] Las 3 Edge Functions desplegadas + sus secretos
- [ ] Vercel importó el repo + las 4 variables de entorno
- [ ] Site URL/Redirect en Supabase apuntando al dominio de Vercel
- [ ] Secretos de GitHub Actions puestos (`PUSH_WEBHOOK_SECRET`, `SUPABASE_DB_URL`, `BACKUP_PASSPHRASE`)
- [ ] SMTP propio conectado para que los correos de confirmación lleguen de verdad — ver [`EMAIL_CONFIRMATION.md`](./EMAIL_CONFIRMATION.md)
