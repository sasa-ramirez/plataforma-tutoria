# Confirmación de correo (SMTP real con Resend)

La app ya maneja el flujo (pantalla "revisa tu correo", reenvío, enlace de
vuelta). Falta que **los correos lleguen de verdad** → configurar SMTP propio.

> El correo integrado de Supabase está limitado a ~3-4/hora y suele caer en
> spam. Para una clase real, usa un proveedor. Aquí: **Resend** (gratis 3.000/mes).

---

## 1. Crear cuenta en Resend (~3 min)
1. [resend.com](https://resend.com) → **Sign up** (puedes con GitHub).
2. **API Keys** → **Create API Key** → copia la key (`re_...`).
3. *(Recomendado)* **Domains** → si tienes dominio, verifícalo. Si no, puedes
   usar el remitente de pruebas `onboarding@resend.dev` para empezar.

## 2. Conectar SMTP en Supabase (~2 min)
1. Supabase → **Authentication** → **Emails** → pestaña **SMTP Settings**
2. Activa **Enable Custom SMTP** y llena:
   | Campo | Valor |
   |-------|-------|
   | Host | `smtp.resend.com` |
   | Port | `465` |
   | Username | `resend` |
   | Password | tu API key `re_...` |
   | Sender email | `onboarding@resend.dev` (o tu dominio verificado) |
   | Sender name | `Tutoría` |
3. **Save**.

## 3. Activar confirmación + URLs
1. **Authentication → Sign In / Providers → Email** → **Confirm email = ON**.
2. **Authentication → URL Configuration**:
   - **Site URL**: `https://plataforma-tutoria.vercel.app`
   - **Redirect URLs**: añade `https://plataforma-tutoria.vercel.app/login`
     y `http://localhost:5173/login` (para desarrollo).

## 4. (Opcional) Personalizar el correo
**Authentication → Emails → Templates → Confirm signup**. Asunto sugerido:
`Confirma tu cuenta en Tutoría`. El cuerpo puede mantener `{{ .ConfirmationURL }}`.

---

## Flujo resultante
1. Usuario se registra → ve **"Revisa tu correo"** (con botón *Reenviar*).
2. Abre el enlace del correo → vuelve a `/login` ya confirmado.
3. Inicia sesión → entra. Si intenta entrar sin confirmar, el login muestra
   un aviso claro y un botón **"Reenviar correo de confirmación"**.

## Mientras configuras Resend (para no bloquearte)
Puedes confirmar usuarios a mano en **Authentication → Users → (usuario) → ⋯ →
Confirm**, o desactivar temporalmente *Confirm email*.
