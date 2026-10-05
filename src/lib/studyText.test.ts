import { describe, it, expect } from "vitest";
import {
  extractPptx,
  loadZipCtor,
  prepareChunks,
  stripRepeatedLines,
  textFromSlideXml,
  CHUNK_CHARS,
  MAX_DOC_CHARS,
} from "./studyText";

const slide = (...paras: string[]) =>
  `<p:sld><p:txBody>${paras.map((t) => `<a:p><a:r><a:t>${t}</a:t></a:r></a:p>`).join("")}</p:txBody></p:sld>`;

async function makePptx(slides: string[], notes: Record<number, string> = {}): Promise<ArrayBuffer> {
  const PizZip = await loadZipCtor();
  const zip = new PizZip();
  slides.forEach((xml, i) => {
    zip.file(`ppt/slides/slide${i + 1}.xml`, xml);
    if (notes[i + 1]) {
      zip.file(
        `ppt/slides/_rels/slide${i + 1}.xml.rels`,
        `<Relationships><Relationship Type="notesSlide" Target="../notesSlides/notesSlide${i + 1}.xml"/></Relationships>`,
      );
      zip.file(`ppt/notesSlides/notesSlide${i + 1}.xml`, slide(notes[i + 1], String(i + 1)));
    }
  });
  const u8 = zip.generate({ type: "uint8array" });
  return u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) as ArrayBuffer;
}

describe("textFromSlideXml", () => {
  it("une los fragmentos de un párrafo y decodifica entidades", () => {
    const xml = `<a:p><a:r><a:t>Hola </a:t></a:r><a:r><a:t>mundo &amp; más</a:t></a:r></a:p><a:p><a:r><a:t>Segunda</a:t></a:r></a:p>`;
    expect(textFromSlideXml(xml)).toBe("Hola mundo & más\nSegunda");
  });
});

describe("extractPptx", () => {
  it("lee las diapositivas en orden numérico y sus notas", async () => {
    const buf = await makePptx(
      [slide("Título"), slide("Dos"), slide("Tres"), slide("Cuatro"), slide("Cinco"), slide("Seis"), slide("Siete"), slide("Ocho"), slide("Nueve"), slide("Diez")],
      { 2: "Explicación del orador" },
    );
    const doc = await extractPptx(buf);
    expect(doc.kind).toBe("pptx");
    expect(doc.pages).toHaveLength(10);
    expect(doc.pages[0]).toBe("Título");
    expect(doc.pages[9]).toBe("Diez"); // slide10 después de slide9, no después de slide1
    expect(doc.pages[1]).toContain("(Notas) Explicación del orador");
  });

  it("falla con un mensaje claro si no es un pptx", async () => {
    await expect(extractPptx(new ArrayBuffer(8))).rejects.toThrow();
  });
});

describe("stripRepeatedLines", () => {
  it("quita encabezados repetidos solo en documentos de 5+ páginas", () => {
    const pages = Array.from({ length: 6 }, (_, i) => `Universidad X\nContenido único ${i}`);
    const out = stripRepeatedLines(pages);
    expect(out[0]).toBe("Contenido único 0");
    expect(stripRepeatedLines(pages.slice(0, 3))[0]).toContain("Universidad X");
  });
});

describe("prepareChunks", () => {
  const doc = (pages: string[]) => ({ kind: "pdf" as const, pages });

  it("rechaza documentos sin texto (escaneados)", () => {
    expect(() => prepareChunks(doc(["", "  ", "x"]))).toThrow(/texto/);
  });

  it("reparte en fragmentos que respetan el tope y etiqueta las páginas", () => {
    const page = "palabra ".repeat(400); // ~3k chars: caben ~3 páginas por fragmento
    const out = prepareChunks(doc(Array.from({ length: 10 }, () => page)));
    expect(out.chunks.length).toBeGreaterThan(1);
    for (const c of out.chunks) expect(c.text.length).toBeLessThanOrEqual(CHUNK_CHARS + 50);
    expect(out.chunks[0].label).toMatch(/^Páginas 1–/);
    expect(out.truncated).toBe(false);
    expect(out.pageCount).toBe(10);
  });

  it("recorta al tope por documento y lo avisa", () => {
    const page = "contenido ".repeat(1500); // ~15k chars
    const out = prepareChunks(doc(Array.from({ length: 20 }, () => page)));
    expect(out.truncated).toBe(true);
    expect(out.charCount).toBeLessThanOrEqual(MAX_DOC_CHARS);
  });

  it("parte una sola página gigante", () => {
    const out = prepareChunks(doc(["a".repeat(60_000)]));
    expect(out.chunks.length).toBeGreaterThanOrEqual(3);
    for (const c of out.chunks) expect(c.text.length).toBeLessThanOrEqual(CHUNK_CHARS + 50);
  });
});
