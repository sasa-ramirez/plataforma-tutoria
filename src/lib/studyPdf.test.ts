import { describe, it, expect, beforeAll } from "vitest";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { extractPdf, prepareChunks } from "./studyText";

/** PDF mínimo con una línea de texto por página (sin dependencias). */
function makePdf(pages: string[]): ArrayBuffer {
  const objs: string[] = [];
  const kids = pages.map((_, i) => `${4 + i * 2} 0 R`).join(" ");
  objs.push("<< /Type /Catalog /Pages 2 0 R >>");
  objs.push(`<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`);
  objs.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  pages.forEach((t, i) => {
    const stream = `BT /F1 12 Tf 50 700 Td (${t}) Tj ET`;
    objs.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${5 + i * 2} 0 R >>`,
    );
    objs.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  });
  let out = "%PDF-1.4\n";
  const offs: number[] = [];
  objs.forEach((o, i) => {
    offs.push(out.length);
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = out.length;
  out +=
    `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` +
    offs.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("");
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(out).buffer as ArrayBuffer;
}

describe("extractPdf", () => {
  beforeAll(async () => {
    // En Node el worker se carga desde disco (en el navegador lo resuelve Vite con ?url).
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(
      resolve("node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs"),
    ).href;
  });

  it("lee el texto de cada página y lo prepara en fragmentos", async () => {
    const doc = await extractPdf(
      makePdf([
        "Primera pagina sobre derivadas y limites en calculo diferencial aplicado. " + "La derivada mide la razon de cambio instantanea de una funcion. ".repeat(2),
        "Segunda pagina sobre integrales definidas e indefinidas con ejemplos resueltos paso a paso. " + "La integral acumula el area bajo la curva de una funcion. ".repeat(2),
      ]),
    );
    expect(doc.kind).toBe("pdf");
    expect(doc.pages).toHaveLength(2);
    expect(doc.pages[0]).toContain("derivadas");
    expect(doc.pages[1]).toContain("integrales");
    const prepared = prepareChunks(doc);
    expect(prepared.chunks[0].text).toContain("[Página 1]");
    expect(prepared.pageCount).toBe(2);
  }, 30000);

  it("da un mensaje claro con un archivo que no es PDF", async () => {
    await expect(extractPdf(new TextEncoder().encode("no soy un pdf").buffer as ArrayBuffer)).rejects.toThrow(
      /No se pudo abrir el PDF/,
    );
  }, 30000);
});
