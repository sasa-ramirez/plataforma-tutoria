import {
  fetchCourseRoster,
  fetchAllAttendance,
  fetchStudentsInfo,
} from "@/services/tutoring";
import type { CourseRosterRow, TutoringSessionType } from "@/types/database";
import { LOGO_UNIGUAJIRA_BASE64, LOGO_ICONTEC_BASE64 } from "@/assets/tutoring/logos";
import type ExcelJS from "exceljs";

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

/** exceljs se carga solo al exportar (import dinámico) para no engordar
 * el paquete que descarga todo el mundo con solo abrir la app. Vite
 * empaqueta su export CJS de formas distintas según el entorno, así que
 * probamos `.default` primero y si no, el módulo tal cual. */
async function loadExcelJS(): Promise<typeof ExcelJS> {
  const mod = await import("exceljs");
  return ((mod as unknown as { default?: typeof ExcelJS }).default ??
    mod) as typeof ExcelJS;
}

// ---------- Estilo (imitando el formato oficial de Bienestar) ----------
const THIN = { style: "thin" as const, color: { argb: "FF000000" } };
const MEDIUM = { style: "medium" as const, color: { argb: "FF000000" } };
const GRID_BORDER = { top: THIN, left: THIN, bottom: THIN, right: THIN };
const HEADER_FILL = {
  type: "pattern" as const,
  pattern: "solid" as const,
  fgColor: { argb: "FFCFE2F3" },
};

type Row = (string | number)[];

/** Encabezado con los dos logos institucionales + título, como en las
 * plantillas oficiales. Devuelve la primera fila libre para seguir. */
function addLetterhead(
  ws: ExcelJS.Worksheet,
  title: string,
  subtitle: string,
  lastCol: number,
): number {
  const titleRows = 3;
  ws.mergeCells(1, 1, titleRows, lastCol);
  const titleCell = ws.getCell(1, 1);
  titleCell.value = `${title}\n${subtitle}`;
  titleCell.font = { bold: true, size: 13, name: "Arial" };
  titleCell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  for (let r = 1; r <= titleRows; r++) {
    ws.getRow(r).height = 22;
    for (let c = 1; c <= lastCol; c++) {
      ws.getCell(r, c).border = {
        top: r === 1 ? MEDIUM : undefined,
        bottom: r === titleRows ? MEDIUM : undefined,
        left: c === 1 ? MEDIUM : undefined,
        right: c === lastCol ? MEDIUM : undefined,
      };
    }
  }

  const wb = ws.workbook;
  const logoId = wb.addImage({ base64: LOGO_UNIGUAJIRA_BASE64, extension: "png" });
  ws.addImage(logoId, { tl: { col: 0.15, row: 0.15 }, ext: { width: 130, height: 81 } });
  const sealId = wb.addImage({ base64: LOGO_ICONTEC_BASE64, extension: "png" });
  ws.addImage(sealId, {
    tl: { col: Math.max(0, lastCol - 2.3), row: 0.15 },
    ext: { width: 120, height: 80 },
  });

  return titleRows + 1;
}

function styleHeaderRow(ws: ExcelJS.Worksheet, rowIdx: number, colCount: number) {
  const row = ws.getRow(rowIdx);
  row.height = 42;
  for (let c = 1; c <= colCount; c++) {
    const cell = row.getCell(c);
    cell.font = { bold: true, size: 9, name: "Arial" };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.fill = HEADER_FILL;
    cell.border = GRID_BORDER;
  }
}

function styleDataRow(ws: ExcelJS.Worksheet, rowIdx: number, colCount: number) {
  const row = ws.getRow(rowIdx);
  for (let c = 1; c <= colCount; c++) {
    const cell = row.getCell(c);
    cell.border = GRID_BORDER;
    cell.font = { size: 9, name: "Calibri" };
    cell.alignment = { vertical: "middle" };
  }
}

function downloadWorkbook(buffer: ExcelJS.Buffer, filename: string) {
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
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
const ROSTER_WIDTHS = [4, 20, 20, 14, 12, 22, 7, 16, 22, 8];

/**
 * Reporte de asistencia (dos hojas: planificadas y ocasionales), con el
 * mismo encabezado institucional del formato oficial y una columna por
 * cada fecha real de sesión registrada (en vez de la grilla de fechas
 * en blanco del original, que reserva el corte completo por adelantado).
 */
export async function exportAttendanceExcel(params: {
  courseId: string;
  courseTitle: string;
  tutorName: string;
  subjectName: string | null;
}) {
  const [roster, attendance, Excel] = await Promise.all([
    fetchCourseRoster(params.courseId),
    fetchAllAttendance(params.courseId),
    loadExcelJS(),
  ]);

  const workbook = new Excel.Workbook();

  const buildSheet = (
    type: TutoringSessionType,
    label: string,
    sheetRoster: CourseRosterRow[],
  ) => {
    const entries = attendance.filter((a) => a.type === type);
    const dates = [...new Set(entries.map((e) => e.session_date))].sort();
    const totalSessions = dates.length;

    const header = [...ROSTER_HEADER, ...dates.map(shortDate), "TOTAL ASISTENCIAS", "TUTORÍAS DICTADAS"];
    const colCount = header.length;

    const ws = workbook.addWorksheet(label);
    ws.columns = [...ROSTER_WIDTHS, ...dates.map(() => 5), 13, 13].map((width) => ({ width }));

    const firstDataRow = addLetterhead(
      ws,
      "CONTROL DE ASISTENCIA DE TUTORÍAS",
      `Responsable: ${params.tutorName}  ·  Grupo: ${params.courseTitle}  ·  Modalidad: ${
        type === "planificada" ? "Planificada" : "Ocasional"
      }`,
      colCount,
    );

    ws.getRow(firstDataRow).values = header;
    styleHeaderRow(ws, firstDataRow, colCount);
    ws.views = [{ state: "frozen", ySplit: firstDataRow }];

    sheetRoster.forEach((s, i) => {
      const { nombre, apellidos } = splitName(s.full_name);
      const studentEntries = entries.filter((e) => e.student_id === s.student_id);
      const presentCount = studentEntries.filter((e) => e.present).length;
      const byDate = new Map(studentEntries.map((e) => [e.session_date, e.present]));
      const row: Row = [
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
      const rowIdx = firstDataRow + 1 + i;
      ws.getRow(rowIdx).values = row;
      styleDataRow(ws, rowIdx, colCount);
    });

    if (sheetRoster.length === 0) {
      const rowIdx = firstDataRow + 1;
      ws.getRow(rowIdx).values = ["Sin estudiantes registrados en esta modalidad."];
      ws.mergeCells(rowIdx, 1, rowIdx, colCount);
    }
  };

  buildSheet("planificada", "PLANIFICADAS", roster);

  const ocasionalIds = [
    ...new Set(attendance.filter((a) => a.type === "ocasional").map((a) => a.student_id)),
  ];
  const ocasionalInfo = await fetchStudentsInfo(ocasionalIds);
  const rosterById = new Map(roster.map((r) => [r.student_id, r]));
  const ocasionalRoster = ocasionalInfo.map((info) => rosterById.get(info.student_id) ?? info);
  buildSheet("ocasional", "OCASIONALES", ocasionalRoster);

  const buffer = await workbook.xlsx.writeBuffer();
  downloadWorkbook(
    buffer,
    `asistencia_${params.courseTitle}_${new Date().toISOString().slice(0, 10)}.xlsx`,
  );
}

const SEGUIMIENTO_HEADER = [
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
const SEGUIMIENTO_WIDTHS = [20, 20, 14, 12, 22, 7, 16, 16, 24, 20, 10, 9, 8, 7, 8];

/**
 * Reporte de seguimiento: mismas columnas del archivo institucional que
 * ya se llena a mano. "CÓDIGO DE LA MATERIA" y "Semestre" quedan en
 * blanco — la plataforma no guarda esos dos datos todavía.
 */
export async function exportSeguimientoExcel(params: {
  courseId: string;
  courseTitle: string;
  subjectName: string | null;
  tutorName: string;
  createdAt: string;
}) {
  const [roster, Excel] = await Promise.all([
    fetchCourseRoster(params.courseId),
    loadExcelJS(),
  ]);

  const created = new Date(params.createdAt);
  const year = created.getFullYear();
  const period = created.getMonth() < 6 ? 1 : 2;

  const workbook = new Excel.Workbook();
  const ws = workbook.addWorksheet("SEGUIMIENTO");
  ws.columns = SEGUIMIENTO_WIDTHS.map((width) => ({ width }));

  const firstDataRow = addLetterhead(
    ws,
    "FORMATO DE SEGUIMIENTO DE NOTAS",
    `Tutor: ${params.tutorName}  ·  Grupo: ${params.courseTitle}  ·  ${year}-${period}`,
    SEGUIMIENTO_HEADER.length,
  );

  ws.getRow(firstDataRow).values = SEGUIMIENTO_HEADER;
  styleHeaderRow(ws, firstDataRow, SEGUIMIENTO_HEADER.length);
  ws.views = [{ state: "frozen", ySplit: firstDataRow }];

  roster.forEach((s, i) => {
    const { nombre, apellidos } = splitName(s.full_name);
    const row: Row = [
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
    const rowIdx = firstDataRow + 1 + i;
    ws.getRow(rowIdx).values = row;
    styleDataRow(ws, rowIdx, SEGUIMIENTO_HEADER.length);
  });

  if (roster.length === 0) {
    const rowIdx = firstDataRow + 1;
    ws.getRow(rowIdx).values = ["Sin estudiantes inscritos en este grupo."];
    ws.mergeCells(rowIdx, 1, rowIdx, SEGUIMIENTO_HEADER.length);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  downloadWorkbook(
    buffer,
    `seguimiento_${params.courseTitle}_${new Date().toISOString().slice(0, 10)}.xlsx`,
  );
}
