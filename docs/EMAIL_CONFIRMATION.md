# Confirmación de correo — lo que de verdad pasa y cómo mitigarlo

Este es el problema de soporte más frecuente de la plataforma: alguien se
registra y el correo de confirmación nunca le llega (o llega tarde, o cae
en Spam/Cuarentena). No hay una solución perfecta sin dominio propio; esto
es lo que sí funciona.

## Por qué pasa

1. **El servicio de correo integrado de Supabase es de pruebas.** Manda
   pocos correos por hora, y muchos filtros lo tratan como sospechoso.
2. **Con SMTP propio conectado** (este proyecto usa Gmail — ver abajo),
   mejora mucho, pero Gmail también tiene un tope diario, y los correos
   institucionales (`@uniguajira.edu.co` y similares) suelen tener un
   **antivirus que abre automáticamente los enlaces** de los correos antes
   de que la persona los vea — como el enlace de confirmación solo sirve
   una vez, queda "gastado" y la cuenta figura como confirmada (o el
   enlace como usado) sin que el estudiante haya hecho nada. Por eso a
   veces parece que "alguien más" tocó la cuenta.
3. **El correo estaba mal escrito.** Muy común: `unigujira.edu.co` en vez
   de `uniguajira.edu.co`, o directo `@edu.co` sin el nombre completo. Esa
   cuenta nunca va a poder confirmarse, porque el correo no existe.

## Lo que ya está construido para mitigarlo

- **En el registro**, el correo se pide **dos veces** (sin poder pegar en
  el segundo campo) y aparece un aviso "¿Quisiste decir...?" si el dominio
  se parece a `uniguajira.edu.co` pero no es exacto (`src/lib/emailDomain.ts`).
- **El coordinador** tiene una pestaña "Sin confirmar" (`/app/coordinacion`)
  donde ve todas las cuentas atascadas, con aviso si el correo parece mal
  escrito, y puede:
  - Confirmar una por una, o todas las que no tienen sospecha de un tirón.
  - Borrar las que tienen el correo mal escrito (solo funciona en cuentas
    que **nunca** se confirmaron, así que jamás borra una cuenta con datos).

## SMTP propio (ya conectado con Gmail)

Supabase → **Authentication → Emails → SMTP Settings**:
- Si "Enable Custom SMTP" está **apagado**, se está usando el cartero de
  pruebas de Supabase (el problema #1 de arriba).
- Conectado con Gmail: Host `smtp.gmail.com`, usando una "contraseña de
  aplicación" de Google (necesita verificación en 2 pasos activada en esa
  cuenta de Gmail). Límite aproximado: ~500 correos/día.

Si algún día se consigue un dominio propio de la universidad, cambiar a un
proveedor como Resend o Brevo mejora la entrega (menos peligro de caer en
spam que con Gmail personal) — pero no es necesario para que la plataforma
funcione hoy.

## Confirmar una cuenta a mano (SQL)

Cuando alguien está atascado y no puede esperar al correo:

```sql
update auth.users set email_confirmed_at = now()
where email = 'correo@uniguajira.edu.co' and email_confirmed_at is null;
```

Confirmar en bloque todos los pendientes de un dominio:

```sql
update auth.users set email_confirmed_at = now()
where email_confirmed_at is null and email like '%@uniguajira.edu.co';
```

**Ojo**: esto no filtra los correos mal escritos — si haces esto en bloque,
revisa primero cuáles tienen pinta de estar mal escritos (dominio raro) y
sácalos de la lista, porque una cuenta confirmada con un correo que no
existe nunca podrá recuperar su contraseña.

## Ponerle contraseña temporal a alguien (sin depender del correo)

```sql
update auth.users
set encrypted_password = extensions.crypt('UnaTemporalQueLeDesEnPrivado', extensions.gen_salt('bf')),
    email_confirmed_at = coalesce(email_confirmed_at, now())
where email = 'correo@uniguajira.edu.co';
```

La persona entra con esa clave y la cambia desde su Perfil.

## Investigar qué le pasó a una cuenta puntual

```sql
select email, created_at, email_confirmed_at, confirmation_sent_at,
       recovery_sent_at, last_sign_in_at, updated_at
from auth.users
where email = 'correo@revisar.co';

select created_at, payload->>'action' as accion, ip_address
from auth.audit_log_entries
where payload->>'actor_username' = 'correo@revisar.co'
order by created_at desc
limit 30;
```

Si la primera consulta no devuelve nada, esa cuenta **no existe con ese
correo exacto** — casi siempre significa que la persona se registró con el
correo escrito distinto (buscar por parte del nombre o correo con `ilike`)
o nunca completó el registro.
