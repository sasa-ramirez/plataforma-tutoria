# Conectar Supabase (paso a paso, ~5 min)

Solo **tú** puedes crear el proyecto (vive en tu cuenta). Aquí están las dos rutas.

---

## Opción A — Nube (recomendada para empezar)

### 1. Crea el proyecto
1. Entra a [supabase.com](https://supabase.com) → **New project**.
2. Ponle nombre, contraseña de BD y región. Espera ~2 min.

### 2. Aplica el esquema
1. En el panel: **SQL Editor** → **New query**.
2. Pega TODO el contenido de [`supabase/migrations/0001_init.sql`](../supabase/migrations/0001_init.sql) y pulsa **Run**.
3. (Opcional) Repite con [`supabase/seed.sql`](../supabase/seed.sql) para tener ejercicios de práctica.

### 3. Copia tus claves
1. **Project Settings → API**.
2. Copia **Project URL** y **anon public key**.
3. En la raíz del proyecto crea `.env` (copia de `.env.example`):
   ```
   VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGci...
   ```

### 4. Confirmación de correo (dev)
**Authentication → Providers → Email** → desactiva *"Confirm email"* mientras desarrollas (así el registro entra directo).

### 5. ¡Listo!
```bash
npm run dev
```
Regístrate como **Profesor**, crea un curso, copia el código, regístrate como **Estudiante** en otro navegador y únete. 🎉

### 6. IA (cuando hagas la Fase 5)
```bash
npm i -g supabase           # instala el CLI
supabase login
supabase link --project-ref TU-REF
supabase functions deploy ai-review
supabase secrets set OPENROUTER_API_KEY=sk-or-...
supabase secrets set OPENROUTER_MODEL=anthropic/claude-3.5-sonnet
```

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
