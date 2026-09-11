import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Printer } from "lucide-react";
import { useReport } from "@/hooks/useReports";
import { fetchReportPhotoUrl } from "@/services/reports";
import { Button } from "@/components/ui/button";
import { FullScreenLoader } from "@/components/common/Spinner";

/** Logos institucionales — se cargan aparte (import dinámico) para no
 * sumarle ~90kb al paquete que descarga todo el mundo con solo abrir
 * la app; esta página solo se visita al imprimir un informe. */
function useLogos() {
  const [logos, setLogos] = useState<{ uni: string; icontec: string } | null>(null);
  useEffect(() => {
    let active = true;
    import("@/assets/tutoring/logos").then((m) => {
      if (active) {
        setLogos({
          uni: `data:image/png;base64,${m.LOGO_UNIGUAJIRA_BASE64}`,
          icontec: `data:image/png;base64,${m.LOGO_ICONTEC_BASE64}`,
        });
      }
    });
    return () => {
      active = false;
    };
  }, []);
  return logos;
}

function Field({ label, value }: { label: string; value: string | number | null }) {
  return (
    <div className="border border-black px-2 py-1.5 text-xs">
      <span className="font-bold">{label}: </span>
      <span>{value || "—"}</span>
    </div>
  );
}

export function PeriodicReportPrintPage() {
  const { reportId = "" } = useParams();
  const { data: report, isLoading } = useReport(reportId);
  const logos = useLogos();
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (report?.photo_path) {
      fetchReportPhotoUrl(report.photo_path).then(setPhotoUrl).catch(() => {});
    }
  }, [report?.photo_path]);

  if (isLoading || !report) return <FullScreenLoader />;

  const fecha = new Date(report.report_date + "T00:00:00");

  return (
    <div className="min-h-screen bg-muted/30 py-6 print:bg-white print:py-0">
      <div className="mx-auto mb-4 flex max-w-3xl items-center justify-between px-4 print:hidden">
        <Button variant="ghost" size="sm" asChild>
          <Link to={`/app/courses/${report.course_id}`}>
            <ArrowLeft className="size-4" /> Volver
          </Link>
        </Button>
        <Button variant="brand" size="sm" onClick={() => window.print()}>
          <Printer className="size-4" /> Imprimir / Guardar PDF
        </Button>
      </div>

      <div className="mx-auto max-w-3xl border border-black bg-white p-6 text-black print:border-0 print:p-0">
        {/* Encabezado */}
        <div className="mb-4 flex items-center justify-between border-2 border-black p-3">
          {logos ? (
            <img src={logos.uni} alt="Universidad de La Guajira" className="h-16" />
          ) : (
            <div className="h-16 w-24" />
          )}
          <div className="flex-1 px-3 text-center">
            <p className="text-sm font-bold">
              Coordinación área de permanencia y graduación exitosa
            </p>
            <p className="text-base font-extrabold">
              Informe periódico de actividades estudiante tutor
            </p>
          </div>
          {logos ? (
            <img src={logos.icontec} alt="ICONTEC · IQNET" className="h-16" />
          ) : (
            <div className="h-16 w-24" />
          )}
        </div>

        <div className="mb-3 flex items-center justify-between text-xs">
          <span className="font-bold">INFORME PERIÓDICO DE ACTIVIDADES</span>
          <span>
            <span className="font-bold">Fecha: </span>
            {fecha.toLocaleDateString("es-CO", { day: "2-digit", month: "2-digit", year: "numeric" })}
          </span>
        </div>

        <div className="mb-3 grid grid-cols-2 gap-1">
          <Field label="Lugar" value={report.place} />
          <Field label="Responsable" value={report.tutor_name} />
          <Field label="Grupo" value={report.group_label} />
          <Field label="Número de participantes" value={report.participants_count} />
        </div>

        <p className="mb-1 bg-black px-2 py-1 text-xs font-bold text-white">
          TUTORÍA PLANIFICADA
        </p>
        <div className="mb-1 grid grid-cols-2 gap-1">
          <Field label="Programa" value={report.program_name} />
          <Field label="Semestre" value={report.semester} />
        </div>
        <div className="mb-1 grid grid-cols-2 gap-1">
          <Field label="Asignatura" value={report.subject_name} />
          <Field label="Docente" value={report.professor_name} />
        </div>

        <div className="mb-1 grid grid-cols-2 gap-2">
          <div className="space-y-2">
            <div className="border border-black p-2 text-xs">
              <p className="font-bold">Temas desarrollados:</p>
              <p className="whitespace-pre-wrap">{report.topics || "—"}</p>
            </div>
            <div className="border border-black p-2 text-xs">
              <p className="font-bold">Descripción:</p>
              <p className="whitespace-pre-wrap">{report.description}</p>
            </div>
            <div className="border border-black p-2 text-xs">
              <p className="font-bold">Observaciones:</p>
              <p className="whitespace-pre-wrap">{report.observations || "—"}</p>
            </div>
          </div>
          <div className="border border-black p-1">
            {photoUrl ? (
              <img src={photoUrl} alt="Evidencia fotográfica" className="h-full w-full object-cover" />
            ) : (
              <div className="grid h-full min-h-[180px] place-items-center text-xs text-gray-400">
                Sin foto
              </div>
            )}
          </div>
        </div>

        <div className="mt-10 flex justify-center">
          <div className="text-center text-xs">
            <div className="mb-1 h-10 w-56 border-b border-black" />
            <p className="font-bold">Firma del tutor responsable</p>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          @page { size: A4; margin: 14mm; }
          nav, header, .print\\:hidden { display: none !important; }
        }
      `}</style>
    </div>
  );
}
