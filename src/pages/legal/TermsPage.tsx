import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

/**
 * PLANTILLA de Términos y Condiciones. NO es asesoría legal.
 * Rellena los [PLACEHOLDERS] y hazla revisar por un abogado,
 * sobre todo si manejas datos de menores de edad.
 */
export function TermsPage() {
  return (
    <div className="mx-auto max-w-2xl px-5 py-10">
      <Link
        to="/register"
        className="mb-6 inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Volver
      </Link>

      <h1 className="text-3xl font-extrabold tracking-tight">
        Términos y Condiciones
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Última actualización: 1 de junio de 2026 · Plataforma: Kódea · Responsable:
        Kódea
      </p>

      <div className="prose-sm mt-8 space-y-6 text-sm leading-relaxed text-foreground/90">
        <section>
          <h2 className="text-base font-bold">1. Aceptación</h2>
          <p>
            Al registrarte y usar Kódea (la “Plataforma”) aceptas estos
            Términos y nuestra{" "}
            <Link to="/privacy" className="text-primary underline">
              Política de Privacidad
            </Link>
            . Si no estás de acuerdo, no uses la Plataforma.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold">2. Descripción del servicio</h2>
          <p>
            La Plataforma es una herramienta educativa para practicar
            programación. Permite a profesores crear cursos y tareas, y a
            estudiantes resolver ejercicios con retroalimentación generada por
            inteligencia artificial.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold">3. Cuentas y registro</h2>
          <p>
            Eres responsable de la veracidad de tus datos y de mantener segura
            tu contraseña. Si eres menor de edad, debes contar con autorización
            de tu padre, madre o tutor legal para registrarte.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold">4. Uso aceptable</h2>
          <p>No está permitido: (a) suplantar a otras personas; (b) intentar
            vulnerar la seguridad; (c) subir contenido ilegal u ofensivo; (d)
            hacer trampa en evaluaciones; (e) usar la Plataforma para fines
            distintos a los educativos.</p>
        </section>

        <section>
          <h2 className="text-base font-bold">
            5. Retroalimentación de IA (importante)
          </h2>
          <p>
            La calificación y los comentarios generados por IA son{" "}
            <strong>orientativos y pueden contener errores</strong>. No
            constituyen una evaluación oficial ni sustituyen el criterio del
            profesor. La Plataforma no garantiza exactitud.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold">6. Propiedad intelectual</h2>
          <p>
            El código que escribes te pertenece. El software, marca y diseño de
            la Plataforma pertenecen a Kódea.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold">7. Limitación de responsabilidad</h2>
          <p>
            La Plataforma se ofrece “tal cual”. En la máxima medida permitida
            por la ley, Kódea no será responsable por daños
            indirectos, pérdida de datos o interrupciones del servicio.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold">8. Cambios y terminación</h2>
          <p>
            Podemos actualizar estos Términos y suspender cuentas que los
            incumplan. Notificaremos cambios relevantes dentro de la Plataforma.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold">9. Ley aplicable y contacto</h2>
          <p>
            Estos Términos se rigen por las leyes de la República de Colombia.
            Para dudas:{" "}
            <strong>soykodea@gmail.com</strong>.
          </p>
        </section>
      </div>

      <p className="mt-10 rounded-xl border border-warning/30 bg-warning/5 p-4 text-xs text-muted-foreground">
        ⚠️ Este texto es una <strong>plantilla de referencia</strong>, no
        asesoría legal. Hazlo revisar por un profesional, especialmente si
        manejas datos de menores de edad.
      </p>
    </div>
  );
}
