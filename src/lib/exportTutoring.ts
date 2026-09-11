import {
  fetchCourseRoster,
  fetchAllAttendance,
  fetchStudentsInfo,
} from "@/services/tutoring";
import type { CourseRosterRow, TutoringSessionType } from "@/types/database";

/** "Alexander David Acosta Polo" -> { nombre: "Alexander David", apellidos: "Acosta Polo" }.
 * La plataforma solo guarda el nombre completo; se reparte a la mitad
 * (redondeando arriba) porque así calzan casi todos los nombres
 * colombianos de 2+2 o 2+1 palabras. Puede fallar en casos raros —
 * son editables a mano en el Excel resultante. */
function splitName(fullName: string | null): { nombre: string; apellidos: string } {
  const parts = (fullName ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { nombre: "", apellidos: "" };
  if (parts.length === 1) return { nombre: parts[0], apellidos: "" };
  const cut = Math.ceil(parts.length / 2);
  return { nombre: parts.slice(0, cut).join(" "), apellidos: parts.slice(cut).join(" ") };
}

function shortDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const ROSTER_HEADER = [
  "#",
  "NOMBRES",
  "APELLIDOS",
  "IDENTIFICACIÓN",
  "CÓDIGO ESTUDIANTIL",
  "PROGRAMA ACADÉMICO",
  "SEXO",
  "GRUPO PRIORIZADO",
  "ASIGNATURA",
  "GRUPO",
];

/**
 * Reporte de asistencia (dos hojas: planificadas y ocasionales), a
 * partir de las sesiones registradas en la app. Genera un .xlsx real
 * (columnas de verdad, no CSV) con una columna por fecha real de
 * sesión, en vez de la grilla de fechas en blanco del formato oficial.
 */
export async function exportAttendanceExcel(params: {
  courseId: string;
  courseTitle: string;
  subjectName: string | null;
}) {
  const [roster, attendance] = await Promise.all([
    fetchCourseRoster(params.courseId),
    fetchAllAttendance(params.courseId),
  ]);

  const XLSX = await import("xlsx");
  const book = XLSX.utils.book_new();

  const buildSheet = (type: TutoringSessionType, sheetRoster: CourseRosterRow[]) => {
    const entries = attendance.filter((a) => a.type === type);
    const dates = [...new Set(entries.map((e) => e.session_date))].sort();
    const totalSessions = dates.length;

    const header = [
      ...ROSTER_HEADER,
      ...dates.map(shortDate),
      "TOTAL DE ASISTENCIAS",
      "TOTAL DE TUTORÍAS DICTADAS",
    ];

    const rows = sheetRoster.map((s, i) => {
      const { nombre, apellidos } = splitName(s.full_name);
      const studentEntries = entries.filter((e) => e.student_id === s.student_id);
      const presentCount = studentEntries.filter((e) => e.present).length;
      const byDate = new Map(studentEntries.map((e) => [e.session_date, e.present]));
      return [
        i + 1,
        nombre,
        apellidos,
        s.national_id ?? "",
        s.student_code ?? "",
        s.program_name ?? "",
        s.sex ?? "",
        s.priority_group ?? "",
        s.subject_name ?? params.subjectName ?? "",
        params.courseTitle,
        ...dates.map((d) => {
          const present = byDate.get(d);
          return present === undefined ? "" : present ? 1 : 0;
        }),
        presentCount,
        totalSessions,
      ];
    });

    const sheet = XLSX.utils.aoa_to_sheet([header, ...rows]);
    sheet["!cols"] = [
      { wch: 4 },
      { wch: 20 },
      { wch: 20 },
      { wch: 14 },
      { wch: 12 },
      { wch: 22 },
      { wch: 7 },
      { wch: 16 },
      { wch: 22 },
      { wch: 8 },
      ...dates.map(() => ({ wch: 6 })),
      { wch: 12 },
      { wch: 12 },
    ];
    return sheet;
  };

  const planificadaSheet = buildSheet("planificada", roster);

  const ocasionalIds = [
    ...new Set(
      attendance.filter((a) => a.type === "ocasional").map((a) => a.student_id),
    ),
  ];
  const ocasionalInfo = await fetchStudentsInfo(ocasionalIds);
  // Conserva el nombre de asignatura/programa del roster si ya estaban
  // inscritos; si no, quedan en blanco (no se puede inventar).
  const rosterById = new Map(roster.map((r) => [r.student_id, r]));
  const ocasionalRoster = ocasionalInfo.map(
    (info) => rosterById.get(info.student_id) ?? info,
  );
  const ocasionalSheet = buildSheet("ocasional", ocasionalRoster);

  XLSX.utils.book_append_sheet(book, planificadaSheet, "PLANIFICADAS");
  XLSX.utils.book_append_sheet(book, ocasionalSheet, "OCASIONALES");
  XLSX.writeFile(
    book,
    `asistencia_${params.courseTitle}_${new Date().toISOString().slice(0, 10)}.xlsx`,
  );
}

/**
 * Reporte de seguimiento: mismas columnas que el archivo institucional
 * que ya llenas a mano (Nombre, Apellidos, Identificación... Periodo).
 * "CÓDIGO DE LA MATERIA" y "Semestre" quedan en blanco — la plataforma
 * no guarda esos dos datos todavía.
 */
export async function exportSeguimientoExcel(params: {
  courseId: string;
  courseTitle: string;
  subjectName: string | null;
  tutorName: string;
  createdAt: string;
}) {
  const roster = await fetchCourseRoster(params.courseId);
  const XLSX = await import("xlsx");

  const created = new Date(params.createdAt);
  const year = created.getFullYear();
  const period = created.getMonth() < 6 ? 1 : 2;

  const header = [
    "Nombre",
    "Apellidos",
    "Identificación",
    "Codigo",
    "Programa",
    "Sexo",
    "Grupos priorizados",
    "CODIGO DE LA MATERIA",
    "Materia",
    "Nombre del tutor",
    "Sede",
    "Semestre",
    "Grupo",
    "Año",
    "Periodo",
  ];

  const rows = roster.map((s) => {
    const { nombre, apellidos } = splitName(s.full_name);
    return [
      nombre,
      apellidos,
      s.national_id ?? "",
      s.student_code ?? "",
      s.program_name ?? "",
      s.sex ?? "",
      s.priority_group ?? "",
      "",
      s.subject_name ?? params.subjectName ?? "",
      params.tutorName,
      "MAICAO",
      "",
      params.courseTitle,
      year,
      period,
    ];
  });

  const sheet = XLSX.utils.aoa_to_sheet([header, ...rows]);
  sheet["!cols"] = [
    { wch: 20 },
    { wch: 20 },
    { wch: 14 },
    { wch: 12 },
    { wch: 22 },
    { wch: 7 },
    { wch: 16 },
    { wch: 16 },
    { wch: 24 },
    { wch: 20 },
    { wch: 10 },
    { wch: 9 },
    { wch: 8 },
    { wch: 7 },
    { wch: 8 },
  ];

  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "SEGUIMIENTO");
  XLSX.writeFile(
    book,
    `seguimiento_${params.courseTitle}_${new Date().toISOString().slice(0, 10)}.xlsx`,
  );
}
