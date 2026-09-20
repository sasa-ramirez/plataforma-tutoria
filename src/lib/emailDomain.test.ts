import { describe, it, expect } from "vitest";
import { suggestEmailDomain } from "./emailDomain";

describe("suggestEmailDomain", () => {
  it("corrige los errores reales de la universidad", () => {
    expect(suggestEmailDomain("wredondocotes@uni.edu.co")).toBe("wredondocotes@uniguajira.edu.co");
    expect(suggestEmailDomain("ydsalinas@unigujira.edu.co")).toBe("ydsalinas@uniguajira.edu.co");
    expect(suggestEmailDomain("iabermudez@edu.co")).toBe("iabermudez@uniguajira.edu.co");
    expect(suggestEmailDomain("ojardila@uniguajora.edu.co")).toBe("ojardila@uniguajira.edu.co");
  });

  it("no molesta con correos bien escritos", () => {
    expect(suggestEmailDomain("ana@uniguajira.edu.co")).toBeNull();
    expect(suggestEmailDomain("ana@gmail.com")).toBeNull();
    expect(suggestEmailDomain("  Ana@Gmail.com ")).toBeNull();
  });

  it("no toma por error otras universidades", () => {
    expect(suggestEmailDomain("profe@unal.edu.co")).toBeNull();
    expect(suggestEmailDomain("profe@unimagdalena.edu.co")).toBeNull();
    expect(suggestEmailDomain("profe@udea.edu.co")).toBeNull();
  });

  it("corrige dominios comunes mal escritos", () => {
    expect(suggestEmailDomain("ana@gmial.com")).toBe("ana@gmail.com");
    expect(suggestEmailDomain("ana@hotmial.com")).toBe("ana@hotmail.com");
  });

  it("ignora entradas incompletas", () => {
    expect(suggestEmailDomain("")).toBeNull();
    expect(suggestEmailDomain("ana")).toBeNull();
    expect(suggestEmailDomain("ana@")).toBeNull();
  });
});
