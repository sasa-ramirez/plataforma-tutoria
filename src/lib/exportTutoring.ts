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
export function splitName(fullName: string | null): { nombre: string; apellidos: string } {
  const parts = (fullName ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { nombre: "", apellidos: "" };
  if (parts.length === 1) return { nombre: parts[0], apellidos: "" };
  const cut = Math.ceil(parts.length / 2);
  return { nombre: parts.slice(0, cut).join(" "), apellidos: parts.slice(cut).join(" ") };
}

const MESES = [
  "ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO",
  "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE",
];

/** "indigena" -> "I" (mismas letras/categorías del formato oficial). */
const PRIORITY_LETTER: Record<string, "I" | "A" | "D" | "V" | "C" | "H"> = {
  indigena: "I",
  afro: "A",
  discapacidad: "D",
  victima: "V",
  lgbtiq: "C",
  frontera: "H",
};

/** exceljs se carga solo al exportar (import dinámico) para no engordar
 * el paquete que descarga todo el mundo con solo abrir la app. Vite
 * empaqueta su export CJS de formas distintas según el entorno, así que
 * probamos `.default` primero y si no, el módulo tal cual. */
async function loadExcelJS(): Promise<typeof ExcelJS> {
  const mod = await import("exceljs");
  return ((mod as unknown as { default?: typeof ExcelJS }).default ?? mod) as typeof ExcelJS;
}

// ---------- Estilo (mismo lenguaje visual del formato oficial de Bienestar) ----------
const THIN = { style: "thin" as const, color: { argb: "FF000000" } };
const MEDIUM = { style: "medium" as const, color: { argb: "FF000000" } };
const GRID_BORDER = { top: THIN, left: THIN, bottom: THIN, right: THIN };
const HEADER_FILL = {
  type: "pattern" as const,
  pattern: "solid" as const,
  fgColor: { argb: "FFCFE2F3" },
};
const HEADER_FONT = { bold: true, size: 9, name: "Arial" };
const HEADER_ALIGN = { horizontal: "center" as const, vertical: "middle" as const, wrapText: true };

/** Encabezado con los dos logos institucionales + título — igual que
 * las plantillas oficiales (mismo texto de título, mismos logos, caja
 * con borde grueso). Devuelve la primera fila libre para seguir. */
function addLetterhead(ws: ExcelJS.Worksheet, title: string, lastCol: number): number {
  const titleRows = 3;
  ws.mergeCells(1, 1, titleRows, lastCol);
  const titleCell = ws.getCell(1, 1);
  titleCell.value = title;
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

function metaRow(ws: ExcelJS.Worksheet, rowIdx: number, text: string, lastCol: number) {
  ws.mergeCells(rowIdx, 1, rowIdx, lastCol);
  const cell = ws.getCell(rowIdx, 1);
  cell.value = text;
  cell.font = { bold: true, size: 10, name: "Calibri" };
  cell.alignment = { horizontal: "left", vertical: "middle" };
  ws.getRow(rowIdx).height = 18;
}

function styleCell(
  ws: ExcelJS.Worksheet,
  row: number,
  col: number,
  opts: { header?: boolean } = {},
) {
  const cell = ws.getCell(row, col);
  cell.border = GRID_BORDER;
  if (opts.header) {
    cell.font = HEADER_FONT;
    cell.alignment = HEADER_ALIGN;
    cell.fill = HEADER_FILL;
  } else {
    cell.font = { size: 9, name: "Calibri" };
    cell.alignment = { vertical: "middle", horizontal: "center" };
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

// Columnas simples (una fila de encabezado, ancho fijo) antes de las
// casillas de sexo/grupo priorizado — mismos campos y orden del
// formato oficial "REGISTRO Y CONTABILIZACIÓN DE ASISTENCIAS".
const SIMPLE_COLS = [
  { label: "#", width: 4 },
  { label: "NOMBRES DEL ESTUDIANTE", width: 20 },
  { label: "APELLIDOS DEL ESTUDIANTE", width: 20 },
  { label: "IDENTIFICACIÓN", width: 14 },
  { label: "CÓDIGO ESTUDIANTIL", width: 12 },
  { label: "PROGRAMA ACADÉMICO", width: 22 },
];
const SEX_COLS = ["F", "M"];
const PRIORITY_COLS = ["I", "A", "D", "V", "C", "H"];
const TAIL_COLS = [
  { label: "ASIGNATURA", width: 22 },
  { label: "GRUPO", width: 8 },
  { label: "REP", width: 6 },
];

/**
 * Reporte de asistencia (dos hojas: planificadas y ocasionales), con el
 * mismo encabezado institucional, las mismas casillas de SEXO (F/M) y
 * GRUPO PRIORIZADO (I/A/D/V/C/H) del formato oficial, y una columna por
 * cada fecha real de sesión registrada agrupada por mes — en vez de la
 * grilla en blanco del original, que reserva el corte completo (con
 * meses fijos, marzo-junio) por adelantado antes de que pase.
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
    title: string,
    sheetRoster: CourseRosterRow[],
  ) => {
    const entries = attendance.filter((a) => a.type === type);
    const dates = [...new Set(entries.map((e) => e.session_date))].sort();
    const totalSessions = dates.length;

    // Agrupa las fechas reales por mes, para el encabezado de dos filas
    // (mes arriba, fusionado; día del mes abajo) — mismo estilo visual
    // que el formato oficial.
    const monthGroups: { label: string; dates: string[] }[] = [];
    for (const d of dates) {
      const dt = new Date(d + "T00:00:00");
      const label2 = `${MESES[dt.getMonth()]} ${dt.getFullYear()}`;
      const last = monthGroups[monthGroups.length - 1];
      if (last && last.label === label2) last.dates.push(d);
      else monthGroups.push({ label: label2, dates: [d] });
    }

    const preCols = SIMPLE_COLS.length + SEX_COLS.length + PRIORITY_COLS.length + TAIL_COLS.length;
    const colCount = preCols + dates.length + 2; // + totales

    const ws = workbook.addWorksheet(label);
    ws.columns = [
      ...SIMPLE_COLS.map((c) => ({ width: c.width })),
      ...SEX_COLS.map(() => ({ width: 4 })),
      ...PRIORITY_COLS.map(() => ({ width: 4 })),
      ...TAIL_COLS.map((c) => ({ width: c.width })),
      ...dates.map(() => ({ width: 4.5 })),
      { width: 12 },
      { width: 12 },
    ];

    let row = addLetterhead(ws, title, colCount);
    metaRow(
      ws,
      row,
      `RESPONSABLE: ${params.tutorName}   ·   GRUPO: ${params.courseTitle}   ·   ASIGNATURA: ${
        params.subjectName ?? ""
      }`,
      colCount,
    );
    row += 1;

    const headerRow1 = row;
    const headerRow2 = row + 1;

    // Columnas simples: una celda fusionada en las 2 filas de encabezado.
    let col = 1;
    for (const c of SIMPLE_COLS) {
      ws.mergeCells(headerRow1, col, headerRow2, col);
      ws.getCell(headerRow1, col).value = c.label;
      styleCell(ws, headerRow1, col, { header: true });
      styleCell(ws, headerRow2, col, { header: true });
      col++;
    }
    // SEXO: título fusionado arriba, F/M abajo.
    const sexStart = col;
    ws.mergeCells(headerRow1, sexStart, headerRow1, sexStart + SEX_COLS.length - 1);
    ws.getCell(headerRow1, sexStart).value = "SEXO";
    for (let i = 0; i < SEX_COLS.length; i++) {
      styleCell(ws, headerRow1, sexStart + i, { header: true });
      ws.getCell(headerRow2, sexStart + i).value = SEX_COLS[i];
      styleCell(ws, headerRow2, sexStart + i, { header: true });
    }
    col += SEX_COLS.length;
    // GRUPO PRIORIZADO: título fusionado arriba, I/A/D/V/C/H abajo.
    const prioStart = col;
    ws.mergeCells(headerRow1, prioStart, headerRow1, prioStart + PRIORITY_COLS.length - 1);
    ws.getCell(headerRow1, prioStart).value = "GRUPO PRIORIZADO";
    for (let i = 0; i < PRIORITY_COLS.length; i++) {
      styleCell(ws, headerRow1, prioStart + i, { header: true });
      ws.getCell(headerRow2, prioStart + i).value = PRIORITY_COLS[i];
      styleCell(ws, headerRow2, prioStart + i, { header: true });
    }
    col += PRIORITY_COLS.length;
    // ASIGNATURA / GRUPO / REP.
    for (const c of TAIL_COLS) {
      ws.mergeCells(headerRow1, col, headerRow2, col);
      ws.getCell(headerRow1, col).value = c.label;
      styleCell(ws, headerRow1, col, { header: true });
      styleCell(ws, headerRow2, col, { header: true });
      col++;
    }
    // Fechas, agrupadas por mes.
    for (const g of monthGroups) {
      if (g.dates.length > 1) {
        ws.mergeCells(headerRow1, col, headerRow1, col + g.dates.length - 1);
      }
      ws.getCell(headerRow1, col).value = g.label;
      for (let i = 0; i < g.dates.length; i++) {
        styleCell(ws, headerRow1, col + i, { header: true });
        const dt = new Date(g.dates[i] + "T00:00:00");
        ws.getCell(headerRow2, col + i).value = dt.getDate();
        styleCell(ws, headerRow2, col + i, { header: true });
      }
      col += g.dates.length;
    }
    // Totales.
    for (const c of ["TOTAL DE\nASISTENCIAS", "TUTORÍAS\nDICTADAS"]) {
      ws.mergeCells(headerRow1, col, headerRow2, col);
      ws.getCell(headerRow1, col).value = c;
      styleCell(ws, headerRow1, col, { header: true });
      styleCell(ws, headerRow2, col, { header: true });
      col++;
    }
    ws.getRow(headerRow1).height = 20;
    ws.getRow(headerRow2).height = 20;
    ws.views = [{ state: "frozen", ySplit: headerRow2 }];

    const firstDataRow = headerRow2 + 1;
    sheetRoster.forEach((s, i) => {
      const { nombre, apellidos } = splitName(s.full_name);
      const studentEntries = entries.filter((e) => e.student_id === s.student_id);
      const presentCount = studentEntries.filter((e) => e.present).length;
      const byDate = new Map(studentEntries.map((e) => [e.session_date, e.present]));
      const letter = s.priority_group ? PRIORITY_LETTER[s.priority_group] : null;

      const rowIdx = firstDataRow + i;
      const values: (string | number)[] = [
        i + 1,
        nombre,
        apellidos,
        s.national_id ?? "",
        s.student_code ?? "",
        s.program_name ?? "",
        s.sex === "F" ? "X" : "",
        s.sex === "M" ? "X" : "",
        letter === "I" ? "X" : "",
        letter === "A" ? "X" : "",
        letter === "D" ? "X" : "",
        letter === "V" ? "X" : "",
        letter === "C" ? "X" : "",
        letter === "H" ? "X" : "",
        s.subject_name ?? params.subjectName ?? "",
        params.courseTitle,
        "",
        ...dates.map((d) => {
          const present = byDate.get(d);
          return present === undefined ? "" : present ? "X" : "";
        }),
        presentCount,
        totalSessions,
      ];
      ws.getRow(rowIdx).values = values;
      for (let c = 1; c <= colCount; c++) styleCell(ws, rowIdx, c);
    });

    if (sheetRoster.length === 0) {
      const rowIdx = firstDataRow;
      ws.getRow(rowIdx).values = ["Sin estudiantes registrados en esta modalidad."];
      ws.mergeCells(rowIdx, 1, rowIdx, colCount);
    }
  };

  buildSheet(
    "planificada",
    "PLANIFICADAS",
    "CONTROL DE ASISTENCIA DE TUTORÍAS PROGRAMADAS Y/O PLANIFICADAS",
    roster,
  );

  const ocasionalIds = [
    ...new Set(attendance.filter((a) => a.type === "ocasional").map((a) => a.student_id)),
  ];
  const ocasionalInfo = await fetchStudentsInfo(ocasionalIds);
  const rosterById = new Map(roster.map((r) => [r.student_id, r]));
  const ocasionalRoster = ocasionalInfo.map((info) => rosterById.get(info.student_id) ?? info);
  buildSheet(
    "ocasional",
    "OCASIONALES",
    "CONTROL DE ASISTENCIA DE TUTORÍAS OCASIONALES",
    ocasionalRoster,
  );

  const buffer = await workbook.xlsx.writeBuffer();
  downloadWorkbook(
    buffer,
    `asistencia_${params.courseTitle}_${new Date().toISOString().slice(0, 10)}.xlsx`,
  );
}

// Mismas 19 columnas, en el mismo orden, del "FORMATO SEGUIMIENTO NOTAS"
// real — es una tabla plana (sin logos ni encabezado especial: el
// archivo original tampoco los tiene, es un listado con autofiltro).
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
  "Notas 1er corte",
  "Notas 2do corte",
  "Nota 3er corte",
  "Final",
  "Nombre del tutor",
  "Sede",
  "Semestre",
  "Grupo",
  "Año",
  "Periodo",
];
const SEGUIMIENTO_WIDTHS = [
  22, 24, 14, 12, 22, 7, 16, 16, 24, 10, 10, 10, 8, 20, 10, 9, 8, 7, 8,
];
const PRIORITY_LABEL: Record<string, string> = {
  indigena: "indigena",
  afro: "afro",
  discapacidad: "discapacidad",
  victima: "victima",
  lgbtiq: "lgtbiq",
  frontera: "frontera",
};

/**
 * Reporte de seguimiento: mismas 19 columnas del Excel institucional
 * que ya se llena a mano, en el mismo orden — sin encabezado ni logos,
 * porque el archivo real tampoco los tiene. "CÓDIGO DE LA MATERIA" y
 * "Semestre" quedan en blanco (la plataforma no guarda esos dos datos
 * todavía); las notas por corte también quedan en blanco para que las
 * llenes tú o la coordinación, como ya haces hoy.
 */
export async function exportSeguimientoExcel(params: {
  courseId: string;
  courseTitle: string;
  subjectName: string | null;
  tutorName: string;
  createdAt: string;
}) {
  const [roster, Excel] = await Promise.all([fetchCourseRoster(params.courseId), loadExcelJS()]);

  const created = new Date(params.createdAt);
  const year = created.getFullYear();
  const period = created.getMonth() < 6 ? 1 : 2;

  const workbook = new Excel.Workbook();
  const ws = workbook.addWorksheet("SEGUIMIENTO");
  ws.columns = SEGUIMIENTO_WIDTHS.map((width) => ({ width }));

  const headerRow = ws.getRow(1);
  headerRow.values = SEGUIMIENTO_HEADER;
  headerRow.height = 32;
  for (let c = 1; c <= SEGUIMIENTO_HEADER.length; c++) {
    const cell = headerRow.getCell(c);
    cell.font = { bold: true, size: 11, name: "Calibri" };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = GRID_BORDER;
  }
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: SEGUIMIENTO_HEADER.length } };

  roster.forEach((s, i) => {
    const { nombre, apellidos } = splitName(s.full_name);
    const rowIdx = i + 2;
    ws.getRow(rowIdx).values = [
      nombre,
      apellidos,
      s.national_id ?? "",
      s.student_code ?? "",
      s.program_name ?? "",
      s.sex ?? "",
      s.priority_group ? PRIORITY_LABEL[s.priority_group] : "",
      "",
      s.subject_name ?? params.subjectName ?? "",
      "",
      "",
      "",
      "",
      params.tutorName,
      "MAICAO",
      "",
      params.courseTitle,
      year,
      period,
    ];
  });

  if (roster.length === 0) {
    ws.getRow(2).values = ["Sin estudiantes inscritos en este grupo."];
    ws.mergeCells(2, 1, 2, SEGUIMIENTO_HEADER.length);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  downloadWorkbook(
    buffer,
    `seguimiento_${params.courseTitle}_${new Date().toISOString().slice(0, 10)}.xlsx`,
  );
}

// Mismos colores/encabezado del formato oficial "HORARIO DE TUTORIAS POR
// GRUPO" (verde institucional). La plantilla real trae una cuadrícula por
// día y franja horaria, pero la plataforma solo guarda UN horario ya
// acordado (texto libre, resultado de la votación) — no datos sueltos
// por día/hora — así que en vez de fingir esa cuadrícula se deja el
// mismo encabezado y el horario acordado en una sola celda.
const SCHEDULE_GREEN_TITLE = {
  type: "pattern" as const,
  pattern: "solid" as const,
  fgColor: { argb: "FF00B050" },
};
const SCHEDULE_GREEN_LIGHT = {
  type: "pattern" as const,
  pattern: "solid" as const,
  fgColor: { argb: "FF92D050" },
};

export async function exportScheduleExcel(params: {
  courseTitle: string;
  tutorName: string;
  programName: string | null;
  subjectName: string | null;
  schedule: string | null;
}) {
  const Excel = await loadExcelJS();
  const workbook = new Excel.Workbook();
  const ws = workbook.addWorksheet("HORARIO");
  ws.columns = Array.from({ length: 6 }, () => ({ width: 21 }));

  ws.mergeCells(1, 1, 1, 6);
  const title = ws.getCell(1, 1);
  title.value = "HORARIO DE TUTORÍAS POR GRUPO";
  title.font = { bold: true, size: 12, name: "Calibri" };
  title.alignment = { horizontal: "center", vertical: "middle" };
  title.fill = SCHEDULE_GREEN_TITLE;
  ws.getRow(1).height = 20;
  for (let c = 1; c <= 6; c++) ws.getCell(1, c).border = GRID_BORDER;

  const headerPairs: [string, number, number][] = [
    [`NOMBRE DEL TUTOR: ${params.tutorName}`, 1, 2],
    [`PROGRAMA: ${params.programName ?? ""}`, 3, 4],
    [`ASIGNATURA: ${params.subjectName ?? ""}`, 5, 6],
  ];
  for (const [text, from, to] of headerPairs) {
    ws.mergeCells(2, from, 2, to);
    const cell = ws.getCell(2, from);
    cell.value = text;
    cell.font = { bold: true, size: 11, name: "Calibri" };
    cell.alignment = { horizontal: "left", vertical: "middle" };
    cell.fill = SCHEDULE_GREEN_LIGHT;
    for (let c = from; c <= to; c++) ws.getCell(2, c).border = GRID_BORDER;
  }

  ws.mergeCells(3, 1, 3, 6);
  const grupoCell = ws.getCell(3, 1);
  grupoCell.value = `GRUPO: ${params.courseTitle}`;
  grupoCell.font = { bold: true, size: 12, name: "Calibri" };
  grupoCell.alignment = { horizontal: "center", vertical: "middle" };
  for (let c = 1; c <= 6; c++) ws.getCell(3, c).border = GRID_BORDER;

  ws.mergeCells(5, 1, 5, 6);
  const label = ws.getCell(5, 1);
  label.value = "HORARIO ACORDADO (definido por votación de los estudiantes):";
  label.font = { bold: true, size: 11, name: "Calibri" };
  label.alignment = { horizontal: "left", vertical: "middle" };

  ws.mergeCells(6, 1, 8, 6);
  const value = ws.getCell(6, 1);
  value.value = params.schedule || "Aún no se ha definido un horario.";
  value.font = { size: 12, name: "Calibri" };
  value.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  for (let r = 6; r <= 8; r++) {
    for (let c = 1; c <= 6; c++) ws.getCell(r, c).border = GRID_BORDER;
  }

  const buffer = await workbook.xlsx.writeBuffer();
  downloadWorkbook(
    buffer,
    `horario_${params.courseTitle}_${new Date().toISOString().slice(0, 10)}.xlsx`,
  );
}
