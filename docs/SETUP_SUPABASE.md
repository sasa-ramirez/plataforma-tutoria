# Conectar Supabase (paso a paso, ~5 min)

Solo **tú** puedes crear el proyecto (vive en tu cuenta). Aquí están las dos rutas.

---

## Opción A — Nube (recomendada para empezar)

### 1. Crea el proyecto
1. Entra a [supabase.com](https://supabase.com) → **New project**.
2. Ponle nombre, contraseña de BD y región. Espera ~2 min.

### 2. Aplica el esquema
1. En el panel: **SQL Editor** → **New query**.
2. Pega y ejecuta **cada archivo de [`supabase/migrations/`](../supabase/migrations/), en orden** (del `0001` al número más alto que haya). Son 35 archivos al momento de escribir esto — todos idempotentes, así que si algo se corre dos veces no pasa nada. No basta con el `0001`: ahí falta todo lo de Coordinación, IA, notificaciones, quiz en vivo, etc.
3. (Opcional) Repite con [`supabase/seed.sql`](../supabase/seed.sql) para tener ejercicios de práctica.

### 3. Copia tus claves
1. **Project Settings → API**.
2. Copia **Project URL** y **anon public key**.
3. En la raíz del proyecto crea `.env` (copia de `.env.example`):
   ```
   VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGci...
   ```

### 4. Confirmación de correo
Mientras pruebas en tu máquina, puedes desactivar *"Confirm email"* en
**Authentication → Providers → Email** para que el registro entre directo.
Para producción, **no la apagues** (cualquiera podría registrarse con un
correo inventado) — conecta un SMTP propio en su lugar. Todo el detalle
(por qué a veces no llega, cómo mitigarlo, cómo confirmar a alguien a
mano) está en [`EMAIL_CONFIRMATION.md`](./EMAIL_CONFIRMATION.md).

### 5. ¡Listo!
```bash
npm run dev
```
Regístrate como **Profesor**, crea un curso, copia el código, regístrate como **Estudiante** en otro navegador y únete. 🎉

### 6. Edge Functions (IA y notificaciones push)
```bash
npm i -g supabase           # instala el CLI
supabase login               # el token necesita el preset "Acceso completo"
supabase link --project-ref TU-REF
supabase functions deploy ai-review --no-verify-jwt
supabase functions deploy ai-generate --no-verify-jwt
supabase functions deploy send-push --no-verify-jwt
supabase secrets set OPENROUTER_API_KEY=sk-or-...
supabase secrets set OPENROUTER_MODEL=anthropic/claude-3.5-sonnet
supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:tucorreo@dominio.com
supabase secrets set PUSH_WEBHOOK_SECRET=un-secreto-largo-al-azar
```
Detalle completo de cada secreto en [`DEPLOY.md`](./DEPLOY.md).

---

## Opción B — Local (Docker)

Requiere Docker Desktop.
```bash
npm i -g supabase
supabase start          # levanta Postgres + Studio + Auth en local
supabase db reset       # aplica migrations/ + seed.sql
```
El comando `supabase start` imprime tu `API URL` y `anon key` locales → ponlos en `.env`.

---

## ¿Quieres que yo configure el `.env`?
Pásame tu **Project URL** y tu **anon key** (la anon es pública, segura para el cliente) y te dejo el `.env` listo. La `service_role` y la `OPENROUTER_API_KEY` **nunca** me las pegues en texto: esas van en *secrets* del servidor.
