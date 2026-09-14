import { describe, it, expect } from "vitest";
import { _internal } from "./autoTagTemplate";

const { applySpecs, tagInline, replaceWholeBody, paragraphText } = _internal;

/** Envuelve un cuerpo de párrafo mínimo en <w:p>...</w:p> con un
 * w14:paraId falso solo para que splitParagraphs lo reconozca. */
function p(body: string): string {
  return `<w:p w14:paraId="X"><w:pPr></w:pPr>${body}</w:p>`;
}
function run(text: string, opts: { bold?: boolean; preserve?: boolean } = {}): string {
  const rPr = opts.bold ? "<w:rPr><w:b/></w:rPr>" : "<w:rPr></w:rPr>";
  const space = opts.preserve ? ' xml:space="preserve"' : "";
  return `<w:r>${rPr}<w:t${space}>${text}</w:t></w:r>`;
}

describe("tagInline", () => {
  it("reemplaza el valor después del label, preservando el espacio del original", () => {
    // Estructura real: "Lugar: " (run en negrita) + "Bienestar Social..." (run normal)
    const para = p(run("Lugar: ", { bold: true, preserve: true }) + run("Bienestar Social Universitario"));
    const out = tagInline(para, "Lugar:", "{lugar}")!;
    expect(paragraphText(out)).toBe("Lugar: {lugar}");
    // El label original (con su formato en negrita) debe seguir intacto.
    expect(out).toContain("<w:b/>");
  });

  it("agrega el valor cuando el label no tiene nada después (caso append)", () => {
    const para = p(run("ACTA N°"));
    const out = tagInline(para, "ACTA N°", "{acta_numero}")!;
    // Debe insertar un espacio antes del tag para no pegar "N°{acta_numero}".
    expect(paragraphText(out)).toBe("ACTA N° {acta_numero}");
  });

  it("devuelve null si el anchor no está en el párrafo", () => {
    const para = p(run("Otra cosa"));
    expect(tagInline(para, "Lugar:", "{lugar}")).toBeNull();
  });

  it("no revienta si el label y el valor están en el mismo run (ej. 'Grupo 1.')", () => {
    const para = p(run("Grupo 1."));
    const out = tagInline(para, "Grupo ", "{grupo}.")!;
    expect(paragraphText(out)).toBe("Grupo {grupo}.");
  });

  it("el run insertado siempre trae xml:space=\"preserve\" (si no, Word puede recortar espacios)", () => {
    const para = p(run("Responsable: ", { preserve: true }) + run("Alguien"));
    const out = tagInline(para, "Responsable:", "{responsable}");
    expect(out).toMatch(/<w:t xml:space="preserve">[^<]*\{responsable\}<\/w:t>/);
  });
});

describe("replaceWholeBody", () => {
  it("reemplaza todo el contenido del párrafo por el tag", () => {
    const para = p(run("14 de abril de 2026"));
    const out = replaceWholeBody(para, "{fecha}");
    expect(out).toContain("{fecha}");
    expect(out).not.toContain("14 de abril");
  });

  it("funciona sobre un párrafo vacío (celda de tabla sin llenar)", () => {
    const para = p("");
    const out = replaceWholeBody(para, "{dia}");
    expect(out).toContain("{dia}");
  });
});

describe("applySpecs", () => {
  it("etiqueta por ocurrencia cuando el anchor se repite (ej. varios 'Programa:')", () => {
    const doc =
      p(run("Programa: ", { preserve: true }) + run("valor viejo 1")) +
      p(run("Programa: ", { preserve: true }) + run("valor viejo 2"));
    const { xml, applied, missing } = applySpecs(doc, [
      { tag: "programa", anchor: "Programa:", mode: "inline" },
    ]);
    expect(applied).toEqual(["programa"]);
    expect(missing).toEqual([]);
    // Solo la PRIMERA ocurrencia se etiqueta (occurrence por defecto = 1).
    const paras = _internal.splitParagraphs(xml).map((pp) => paragraphText(pp.xml));
    expect(paras[0]).toBe("Programa: {programa}");
    expect(paras[1]).toBe("Programa: valor viejo 2");
  });

  it("modo offset: encuentra el valor N párrafos después del anchor (tabla de fecha)", () => {
    const doc = [
      p(run("Día")),
      p(run("Mes")),
      p(run("Año")),
      p(""), // valor día (vacío en la plantilla oficial)
      p(""), // valor mes
      p(""), // valor año
    ].join("");
    const { xml, applied, missing } = applySpecs(doc, [
      { tag: "dia", anchor: "Día", mode: "offset", offset: 3 },
      { tag: "mes", anchor: "Mes", mode: "offset", offset: 3 },
      { tag: "anio", anchor: "Año", mode: "offset", offset: 3 },
    ]);
    expect(applied).toEqual(["dia", "mes", "anio"]);
    expect(missing).toEqual([]);
    expect(xml).toContain("{dia}");
    expect(xml).toContain("{mes}");
    expect(xml).toContain("{anio}");
  });

  it("modo next-nonempty: salta párrafos vacíos hasta encontrar el contenido", () => {
    const doc = p(run("DESARROLLO")) + p("") + p("") + p(run("texto viejo"));
    const { xml, applied } = applySpecs(doc, [
      { tag: "desarrollo", anchor: "DESARROLLO", mode: "next-nonempty" },
    ]);
    expect(applied).toEqual(["desarrollo"]);
    expect(xml).toContain("{desarrollo}");
    expect(xml).not.toContain("texto viejo");
  });

  it("reporta como 'missing' los campos cuyo anchor no aparece en el documento", () => {
    const doc = p(run("Algo que no es ningún campo conocido"));
    const { applied, missing } = applySpecs(doc, [
      { tag: "lugar", anchor: "Lugar:", mode: "inline" },
    ]);
    expect(applied).toEqual([]);
    expect(missing).toEqual(["lugar"]);
  });
});

describe("specs reales (BS-F-17 / AD-F-01)", () => {
  it("BS-F-17 tiene 15 campos definidos (el formato oficial completo)", () => {
    expect(_internal.BS_F17_SPECS).toHaveLength(15);
  });

  it("AD-F-01 tiene 10 campos con ancla de texto (tutor_nombre/docente_nombre quedan aparte)", () => {
    expect(_internal.AD_F01_SPECS).toHaveLength(10);
    const tags = _internal.AD_F01_SPECS.map((s) => s.tag);
    expect(tags).not.toContain("tutor_nombre");
    expect(tags).not.toContain("docente_nombre");
  });
});
