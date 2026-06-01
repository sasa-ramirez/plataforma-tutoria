import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

/**
 * PLANTILLA de Política de Privacidad / Tratamiento de Datos.
 * NO es asesoría legal. Adáptala a la ley de tu país (en Colombia:
 * Ley 1581 de 2012, Habeas Data) y revísala con un abogado,
 * sobre todo si hay menores de edad.
 */
export function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl px-5 py-10">
      <Link
        to="/register"
        className="mb-6 inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Volver
      </Link>

      <h1 className="text-3xl font-extrabold tracking-tight">
        Política de Privacidad
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Última actualización: [FECHA] · Responsable del tratamiento:
        [TU NOMBRE/EMPRESA] · Contacto: [CORREO]
      </p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-foreground/90">
        <section>
          <h2 className="text-base font-bold">1. Qué datos recopilamos</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>De registro: nombre, correo electrónico y rol.</li>
            <li>De uso: cursos, tareas, código enviado y calificaciones.</li>
            <li>
              En modo examen: eventos de actividad (cambio de pestaña,
              pegado de texto) con fecha y hora.
            </li>
            <li>Técnicos: datos de sesión necesarios para autenticarte.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-bold">2. Para qué los usamos</h2>
          <p>
            Para prestar el servicio educativo: gestionar tu cuenta, mostrar
            cursos y tareas, generar retroalimentación con IA, calcular tu
            progreso y permitir al profesor evaluar.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold">3. Base legal y consentimiento</h2>
          <p>
            Tratamos tus datos con tu <strong>consentimiento</strong>, que
            otorgas al registrarte, y para la ejecución del servicio. Puedes
            retirarlo solicitando la eliminación de tu cuenta.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold">4. Con quién se comparten</h2>
          <p>
            Usamos proveedores que procesan datos por nuestra cuenta, bajo sus
            propias medidas de seguridad:
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li><strong>Supabase</strong> — base de datos y autenticación.</li>
            <li><strong>Vercel</strong> — alojamiento de la aplicación.</li>
            <li><strong>OpenRouter</strong> — procesamiento del código por IA.</li>
            <li><strong>Proveedor de correo</strong> — envío de confirmaciones.</li>
          </ul>
          <p>No vendemos tus datos a terceros.</p>
        </section>

        <section>
          <h2 className="text-base font-bold">5. Conservación</h2>
          <p>
            Conservamos tus datos mientras tu cuenta esté activa. Al eliminarla,
            los borramos o anonimizamos, salvo obligación legal de conservarlos.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold">6. Tus derechos</h2>
          <p>
            Puedes acceder, rectificar, actualizar o solicitar la eliminación de
            tus datos, y revocar tu consentimiento, escribiendo a{" "}
            <strong>[CORREO]</strong>.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold">7. Menores de edad</h2>
          <p>
            Si eres menor de edad, necesitas autorización de tu padre, madre o
            tutor para usar la Plataforma y para el tratamiento de tus datos. Si
            detectamos datos de un menor sin autorización, los eliminaremos.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold">8. Seguridad</h2>
          <p>
            Aplicamos medidas como cifrado en tránsito, control de acceso por
            roles y reglas de seguridad a nivel de base de datos para proteger
            tu información. Ningún sistema es 100% infalible.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold">9. Cambios</h2>
          <p>
            Podemos actualizar esta Política. Publicaremos la versión vigente con
            su fecha en esta página.
          </p>
        </section>
      </div>

      <p className="mt-10 rounded-xl border border-warning/30 bg-warning/5 p-4 text-xs text-muted-foreground">
        ⚠️ Plantilla de referencia, no asesoría legal. Adáptala a la ley de tu
        país y revísala con un abogado, en especial respecto a menores de edad.
      </p>
    </div>
  );
}
