# 🚀 Despliegue (GitHub + Vercel + Supabase)

Objetivo: que la app viva en la nube y **no dependa de tu PC**.
Orden recomendado: **1) GitHub → 2) Supabase → 3) Vercel**.

El repo ya está commiteado localmente. Solo faltan los clics que requieren tus cuentas.

---

## 1️⃣ Subir a GitHub

### Opción A — Web + git (la más simple, sin instalar nada)
1. Ve a [github.com/new](https://github.com/new).
2. Nombre: `plataforma-tutoria`. **NO** marques "Add README/.gitignore" (ya los tenemos). Crea el repo **vacío**.
3. GitHub te mostrará la URL. Copia los comandos de "…or push an existing repository". Serán estos (cambia TU-USUARIO):
   ```bash
   git remote add origin https://github.com/TU-USUARIO/plataforma-tutoria.git
   git branch -M main
   git push -u origin main
   ```
4. Al hacer `git push`, **Git para Windows abrirá una ventana del navegador** para que inicies sesión en GitHub (Git Credential Manager). Acepta y listo. ✅

> Si prefieres el CLI: instala GitHub CLI con `winget install GitHub.cli`, reinicia la terminal, `gh auth login`, y luego `gh repo create plataforma-tutoria --public --source=. --push`.

---

## 2️⃣ Crear Supabase

Sigue [SETUP_SUPABASE.md](./SETUP_SUPABASE.md). Resumen:
1. [supabase.com](https://supabase.com) → **New project** (guarda la contraseña de BD).
2. **SQL Editor** → pega `supabase/migrations/0001_init.sql` → **Run**.
3. (Opcional) pega `supabase/seed.sql` → **Run** (ejercicios de práctica).
4. **Settings → API** → copia **Project URL** y **anon public key**.
5. **Authentication → Providers → Email** → desactiva *Confirm email* (dev).

### IA (opcional, para que funcione el feedback)
Necesitas el CLI de Supabase y una API key de OpenRouter:
```bash
npm i -g supabase
supabase login
supabase link --project-ref TU-REF        # TU-REF está en la URL del proyecto
supabase functions deploy ai-review
supabase secrets set OPENROUTER_API_KEY=sk-or-...
supabase secrets set OPENROUTER_MODEL=anthropic/claude-3.5-sonnet
```
> Sin esto, la app funciona completa; solo el botón "Enviar" mostrará un aviso de que la IA no está disponible.

---

## 3️⃣ Desplegar en Vercel

1. [vercel.com/new](https://vercel.com/new) → **Import Git Repository** → elige `plataforma-tutoria`.
2. Vercel detecta **Vite** solo (gracias a `vercel.json`). No cambies nada del build.
3. **Environment Variables** → añade:
   | Name | Value |
   |------|-------|
   | `VITE_SUPABASE_URL` | tu Project URL |
   | `VITE_SUPABASE_ANON_KEY` | tu anon key |
4. **Deploy**. En ~1 min tendrás una URL pública tipo `https://plataforma-tutoria.vercel.app`. 🎉

### Importante tras el deploy
- En Supabase → **Authentication → URL Configuration** → pon tu dominio de Vercel en **Site URL** y **Redirect URLs** (ej. `https://plataforma-tutoria.vercel.app`). Así el login funciona en producción.

---

## 🔄 Flujo de trabajo a partir de ahora
Cada `git push` a `main` redepliega Vercel automáticamente. Ya no dependes de tu PC: editas, haces push, y la nube reconstruye.

---

## ¿Netlify en vez de Vercel?
También está soportado (incluí `public/_redirects`).
1. [app.netlify.com](https://app.netlify.com) → **Add new site → Import from Git**.
2. Build command: `npm run build` · Publish directory: `dist`.
3. Site settings → **Environment variables** → las mismas `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.

---

## ✅ Checklist
- [ ] Repo en GitHub (`git push` hecho)
- [ ] Proyecto Supabase creado + SQL aplicado
- [ ] `.env` local con URL + anon key (para desarrollo)
- [ ] Vercel importó el repo + variables de entorno
- [ ] Site URL/Redirect en Supabase apuntando al dominio de Vercel
- [ ] (Opcional) Edge Function `ai-review` desplegada + secrets
