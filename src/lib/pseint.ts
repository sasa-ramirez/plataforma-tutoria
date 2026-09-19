// Intérprete de PSeInt (pseudocódigo en español) que corre 100% en el navegador.
// Cubre lo que se enseña en un curso de lógica: variables, Leer/Escribir,
// Si, Segun, Mientras, Repetir, Para, arreglos, funciones y subprocesos.
// La ejecución es síncrona con un tope de pasos para cortar ciclos infinitos.

type Value = number | string | boolean;
interface ArrayVal {
  dims: number[];
  data: Map<string, Value>;
}
type Slot = Value | ArrayVal;
type VarType = "num" | "str" | "bool";

export interface PseintResult {
  ok: boolean;
  stdout: string;
  error: string | null;
  /** Modo interactivo: el programa se detuvo en un «Leer» esperando un dato. */
  waiting: boolean;
}

class PseError extends Error {
  constructor(
    message: string,
    public line: number,
  ) {
    super(message);
  }
}
class ReturnSignal {
  constructor(public value: Value | undefined) {}
}
class InputRequired {}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------- Utilidades

const ACCENTS: Record<string, string> = {
  á: "a",
  é: "e",
  í: "i",
  ó: "o",
  ú: "u",
  ü: "u",
};
function deaccent(s: string): string {
  return s.toLowerCase().replace(/[áéíóúü]/g, (c) => ACCENTS[c] ?? c);
}

/** Igual que deaccent pero tapa el contenido de los textos entre comillas
 * (misma longitud), para poder buscar palabras clave sin confundirse. */
function maskedNorm(s: string): string {
  let out = "";
  let quote: string | null = null;
  for (const ch of s) {
    if (quote) {
      if (ch === quote) {
        quote = null;
        out += ch;
      } else out += "_";
    } else if (ch === '"' || ch === "'") {
      quote = ch;
      out += ch;
    } else out += deaccent(ch);
  }
  return out;
}

const ID_RE = "[a-zñ_][a-z0-9ñ_]*";

function fmtNum(n: number): string {
  if (Number.isNaN(n)) return "NaN";
  if (!Number.isFinite(n)) return n > 0 ? "Infinito" : "-Infinito";
  if (Number.isInteger(n)) return String(n === 0 ? 0 : n);
  return String(parseFloat(n.toFixed(10)));
}
function toText(v: Value): string {
  if (typeof v === "number") return fmtNum(v);
  if (typeof v === "boolean") return v ? "VERDADERO" : "FALSO";
  return v;
}

// ------------------------------------------------------------------ Preproceso

interface Line {
  text: string;
  norm: string;
  line: number;
}

/** Quita comentarios y separa en sentencias (por salto de línea o `;`). */
function splitStatements(source: string): Line[] {
  const out: Line[] = [];
  let cur = "";
  let quote: string | null = null;
  let line = 1;
  let startLine = 1;
  const flush = () => {
    const t = cur.trim();
    if (t) out.push({ text: t, norm: maskedNorm(t), line: startLine });
    cur = "";
  };
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    const next = source[i + 1];
    if (quote) {
      if (ch === "\n") {
        // texto sin cerrar: se corta en la línea
        quote = null;
        flush();
        line++;
        startLine = line;
        continue;
      }
      cur += ch;
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === "/" && next === "/") {
      while (i < source.length && source[i] !== "\n") i++;
      i--;
      continue;
    }
    if (ch === "/" && next === "*") {
      i += 2;
      while (i < source.length && !(source[i] === "*" && source[i + 1] === "/")) {
        if (source[i] === "\n") line++;
        i++;
      }
      i++;
      continue;
    }
    if (ch === "\n") {
      flush();
      line++;
      startLine = line;
      continue;
    }
    if (ch === ";") {
      flush();
      startLine = line;
      continue;
    }
    if (ch === '"' || ch === "'") quote = ch;
    if (!cur.trim()) startLine = line;
    cur += ch;
  }
  flush();
  return out;
}

/** Parte por comas que no estén dentro de paréntesis, corchetes ni textos. */
function splitTopLevel(text: string, norm: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < norm.length; i++) {
    const c = norm[i];
    if (c === "(" || c === "[") depth++;
    else if (c === ")" || c === "]") depth--;
    else if (c === "," && depth === 0) {
      parts.push(text.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(text.slice(start));
  return parts.map((p) => p.trim()).filter((p) => p !== "");
}

// ------------------------------------------------------------------ Expresiones

type Expr =
  | { k: "num"; v: number }
  | { k: "str"; v: string }
  | { k: "bool"; v: boolean }
  | { k: "var"; name: string; raw: string }
  | { k: "index"; name: string; raw: string; idx: Expr[] }
  | { k: "call"; name: string; raw: string; args: Expr[] }
  | { k: "bin"; op: string; l: Expr; r: Expr }
  | { k: "un"; op: "-" | "no"; e: Expr };

interface Tok {
  t: "num" | "str" | "id" | "op";
  v: string;
  raw: string;
}

const OPS = [
  "<>",
  "<=",
  ">=",
  "&&",
  "||",
  "!=",
  "==",
  "+",
  "-",
  "*",
  "/",
  "^",
  "%",
  "(",
  ")",
  "[",
  "]",
  ",",
  "=",
  "<",
  ">",
  "&",
  "|",
  "~",
  "!",
];

function tokenize(s: string, line: number): Tok[] {
  const toks: Tok[] = [];
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (/[0-9]/.test(ch) || (ch === "." && /[0-9]/.test(s[i + 1] ?? ""))) {
      const m = /^[0-9]*\.?[0-9]+/.exec(s.slice(i)) ?? /^[0-9]+/.exec(s.slice(i))!;
      toks.push({ t: "num", v: m[0], raw: m[0] });
      i += m[0].length;
      continue;
    }
    if (ch === '"' || ch === "'") {
      const end = s.indexOf(ch, i + 1);
      if (end === -1) throw new PseError("Falta cerrar unas comillas.", line);
      toks.push({ t: "str", v: s.slice(i + 1, end), raw: s.slice(i, end + 1) });
      i = end + 1;
      continue;
    }
    const idm = /^[A-Za-zÁÉÍÓÚÜáéíóúüÑñ_][A-Za-zÁÉÍÓÚÜáéíóúüÑñ_0-9]*/.exec(s.slice(i));
    if (idm) {
      toks.push({ t: "id", v: deaccent(idm[0]), raw: idm[0] });
      i += idm[0].length;
      continue;
    }
    const op = OPS.find((o) => s.startsWith(o, i));
    if (op) {
      toks.push({ t: "op", v: op, raw: op });
      i += op.length;
      continue;
    }
    throw new PseError(`Símbolo no reconocido: «${ch}».`, line);
  }
  return toks;
}

class ExprParser {
  private pos = 0;
  constructor(
    private toks: Tok[],
    private line: number,
  ) {}

  parseAll(): Expr {
    if (this.toks.length === 0) throw new PseError("Falta una expresión.", this.line);
    const e = this.parseOr();
    if (this.pos < this.toks.length) {
      throw new PseError(
        `No entiendo la expresión cerca de «${this.toks[this.pos].raw}».`,
        this.line,
      );
    }
    return e;
  }

  private peek(): Tok | undefined {
    return this.toks[this.pos];
  }
  private isOp(...vals: string[]): boolean {
    const t = this.peek();
    return !!t && t.t === "op" && vals.includes(t.v);
  }
  private isWord(...vals: string[]): boolean {
    const t = this.peek();
    return !!t && t.t === "id" && vals.includes(t.v);
  }

  private parseOr(): Expr {
    let l = this.parseAnd();
    while (this.isOp("|", "||") || this.isWord("o")) {
      this.pos++;
      l = { k: "bin", op: "or", l, r: this.parseAnd() };
    }
    return l;
  }
  private parseAnd(): Expr {
    let l = this.parseNot();
    while (this.isOp("&", "&&") || this.isWord("y")) {
      this.pos++;
      l = { k: "bin", op: "and", l, r: this.parseNot() };
    }
    return l;
  }
  private parseNot(): Expr {
    if (this.isOp("~", "!") || this.isWord("no")) {
      this.pos++;
      return { k: "un", op: "no", e: this.parseNot() };
    }
    return this.parseRel();
  }
  private parseRel(): Expr {
    let l = this.parseAdd();
    while (this.isOp("=", "==", "<>", "!=", "<", ">", "<=", ">=")) {
      let op = this.peek()!.v;
      this.pos++;
      if (op === "==") op = "=";
      if (op === "!=") op = "<>";
      l = { k: "bin", op, l, r: this.parseAdd() };
    }
    return l;
  }
  private parseAdd(): Expr {
    let l = this.parseMul();
    while (this.isOp("+", "-")) {
      const op = this.peek()!.v;
      this.pos++;
      l = { k: "bin", op, l, r: this.parseMul() };
    }
    return l;
  }
  private parseMul(): Expr {
    let l = this.parseUnary();
    while (this.isOp("*", "/", "%") || this.isWord("mod")) {
      let op = this.peek()!.v;
      this.pos++;
      if (op === "mod") op = "%";
      l = { k: "bin", op, l, r: this.parseUnary() };
    }
    return l;
  }
  private parseUnary(): Expr {
    if (this.isOp("-")) {
      this.pos++;
      return { k: "un", op: "-", e: this.parseUnary() };
    }
    if (this.isOp("+")) {
      this.pos++;
      return this.parseUnary();
    }
    return this.parsePow();
  }
  private parsePow(): Expr {
    const base = this.parsePrimary();
    if (this.isOp("^")) {
      this.pos++;
      return { k: "bin", op: "^", l: base, r: this.parseUnary() };
    }
    return base;
  }
  private parseArgs(close: string): Expr[] {
    const args: Expr[] = [];
    if (this.isOp(close)) {
      this.pos++;
      return args;
    }
    for (;;) {
      args.push(this.parseOr());
      if (this.isOp(",")) {
        this.pos++;
        continue;
      }
      if (this.isOp(close)) {
        this.pos++;
        return args;
      }
      throw new PseError(`Falta cerrar «${close}».`, this.line);
    }
  }
  private parsePrimary(): Expr {
    const t = this.peek();
    if (!t) throw new PseError("La expresión está incompleta.", this.line);
    this.pos++;
    if (t.t === "num") return { k: "num", v: parseFloat(t.v) };
    if (t.t === "str") return { k: "str", v: t.v };
    if (t.t === "op" && t.v === "(") {
      const e = this.parseOr();
      if (!this.isOp(")")) throw new PseError("Falta cerrar un paréntesis.", this.line);
      this.pos++;
      return e;
    }
    if (t.t === "id") {
      if (t.v === "verdadero") return { k: "bool", v: true };
      if (t.v === "falso") return { k: "bool", v: false };
      if (this.isOp("(")) {
        this.pos++;
        return { k: "call", name: t.v, raw: t.raw, args: this.parseArgs(")") };
      }
      if (this.isOp("[")) {
        this.pos++;
        return { k: "index", name: t.v, raw: t.raw, idx: this.parseArgs("]") };
      }
      return { k: "var", name: t.v, raw: t.raw };
    }
    throw new PseError(`No entiendo «${t.raw}» en esta expresión.`, this.line);
  }
}

function parseExpr(text: string, line: number): Expr {
  return new ExprParser(tokenize(text, line), line).parseAll();
}

// ------------------------------------------------------------------ Sentencias

interface LValue {
  name: string;
  raw: string;
  idx: Expr[] | null;
}

type Stmt = { line: number } & (
  | { k: "assign"; target: LValue; expr: Expr }
  | { k: "write"; args: Expr[]; newline: boolean }
  | { k: "read"; targets: LValue[] }
  | { k: "if"; cond: Expr; then: Stmt[]; else: Stmt[] }
  | { k: "while"; cond: Expr; body: Stmt[] }
  | { k: "repeat"; body: Stmt[]; cond: Expr }
  | {
      k: "for";
      target: LValue;
      from: Expr;
      to: Expr;
      step: Expr | null;
      body: Stmt[];
    }
  | { k: "switch"; subject: Expr; cases: { values: Expr[]; body: Stmt[] }[]; other: Stmt[] }
  | { k: "define"; names: string[]; type: VarType | null }
  | { k: "dim"; arrays: { name: string; raw: string; dims: Expr[] }[] }
  | { k: "call"; name: string; raw: string; args: Expr[] }
  | { k: "return"; expr: Expr }
  | { k: "noop" }
);

interface Param {
  name: string;
  byRef: boolean;
}
interface FuncDef {
  name: string;
  ret: string | null;
  params: Param[];
  body: Stmt[];
}
interface Program {
  main: Stmt[] | null;
  funcs: Map<string, FuncDef>;
}

const RE = {
  finSi: /^fin\s*si\b/,
  sino: /^(sino|si\s+no)\b/,
  finMientras: /^fin\s*mientras\b/,
  finPara: /^fin\s*para\b/,
  finSegun: /^fin\s*segun\b/,
  finFunc: /^fin\s*(funcion|subproceso)\b/,
  finAlg: /^fin\s*(algoritmo|proceso)\b/,
  hastaQue: /^hasta\s+que\b/,
  mientrasQue: /^mientras\s+que\b/,
  deOtroModo: /^de\s+otro\s+modo\b/,
};

function findAssign(norm: string): { i: number; len: number } | null {
  let depth = 0;
  for (let i = 0; i < norm.length; i++) {
    const c = norm[i];
    if (c === "(" || c === "[") depth++;
    else if (c === ")" || c === "]") depth--;
    else if (depth === 0) {
      if (norm.startsWith("<-", i)) return { i, len: 2 };
      if (norm.startsWith(":=", i)) return { i, len: 2 };
      if (c === "=") {
        const prev = norm[i - 1] ?? "";
        const next = norm[i + 1] ?? "";
        if (!"<>!=:".includes(prev) && next !== "=") return { i, len: 1 };
      }
    }
  }
  return null;
}

/** Busca `label:` de un caso de Segun; devuelve el texto tras los dos puntos. */
function findCaseColon(norm: string): number {
  let depth = 0;
  for (let i = 0; i < norm.length; i++) {
    const c = norm[i];
    if (c === "(" || c === "[") depth++;
    else if (c === ")" || c === "]") depth--;
    else if (c === ":" && depth === 0 && norm[i + 1] !== "=") return i;
  }
  return -1;
}

class Parser {
  private pos = 0;
  constructor(private lines: Line[]) {}

  parseProgram(): Program {
    const prog: Program = { main: null, funcs: new Map() };
    while (this.pos < this.lines.length) {
      const L = this.lines[this.pos];
      if (/^(algoritmo|proceso)\b/.test(L.norm)) {
        if (prog.main) throw new PseError("Hay dos «Algoritmo» en el programa.", L.line);
        this.pos++;
        prog.main = this.parseBlock((n) => RE.finAlg.test(n));
        this.expectEnd(RE.finAlg, "FinAlgoritmo", L.line);
      } else if (/^(funcion|subproceso)\b/.test(L.norm)) {
        const f = this.parseFunction(L);
        prog.funcs.set(f.name, f);
      } else {
        throw new PseError(
          "El programa debe empezar con «Algoritmo NombreDelPrograma» y terminar con «FinAlgoritmo».",
          L.line,
        );
      }
    }
    if (!prog.main) {
      throw new PseError("Falta la línea «Algoritmo NombreDelPrograma».", 1);
    }
    return prog;
  }

  private expectEnd(re: RegExp, label: string, openLine: number) {
    const L = this.lines[this.pos];
    if (!L || !re.test(L.norm)) {
      throw new PseError(`Falta «${label}» (para cerrar lo que abriste en la línea ${openLine}).`, openLine);
    }
    this.pos++;
  }

  private parseBlock(stop: (norm: string) => boolean): Stmt[] {
    const out: Stmt[] = [];
    while (this.pos < this.lines.length) {
      const n = this.lines[this.pos].norm;
      // Si aparece el cierre del programa/función sin haber cerrado el bloque
      // interno, se corta aquí para que el error diga qué falta cerrar.
      if (stop(n) || RE.finAlg.test(n) || RE.finFunc.test(n)) break;
      out.push(this.parseStatement());
    }
    return out;
  }

  private parseFunction(L: Line): FuncDef {
    const m = new RegExp(
      `^(?:funcion|subproceso)\\s+(?:(${ID_RE})\\s*(?:<-|=)\\s*)?(${ID_RE})\\s*(?:\\((.*)\\))?\\s*$`,
    ).exec(L.norm);
    if (!m) throw new PseError("La definición de la función no es válida.", L.line);
    const params: Param[] = [];
    if (m[3]) {
      for (const p of m[3].split(",")) {
        let s = p.trim();
        if (!s) continue;
        const byRef = /\bpor\s+referencia\b/.test(s);
        s = s
          .replace(/\bpor\s+(referencia|valor)\b/g, " ")
          .replace(/\bcomo\b.*$/, " ")
          .trim();
        if (!new RegExp(`^${ID_RE}$`).test(s)) {
          throw new PseError(`Parámetro no válido: «${p.trim()}».`, L.line);
        }
        params.push({ name: s, byRef });
      }
    }
    this.pos++;
    const body = this.parseBlock((n) => RE.finFunc.test(n));
    this.expectEnd(RE.finFunc, "FinFuncion", L.line);
    return { name: m[2], ret: m[1] ?? null, params, body };
  }

  private parseLValue(text: string, line: number): LValue {
    const norm = maskedNorm(text.trim());
    const m = new RegExp(`^(${ID_RE})\\s*([\\[(](.*)[\\])])?$`).exec(norm);
    if (!m) throw new PseError(`«${text.trim()}» no es una variable válida.`, line);
    const raw = text.trim().match(/^[^\s[(]+/)![0];
    if (!m[2]) return { name: m[1], raw, idx: null };
    const inner = text.trim().slice(raw.length).trim().slice(1, -1);
    const idx = splitTopLevel(inner, maskedNorm(inner)).map((p) => parseExpr(p, line));
    return { name: m[1], raw, idx };
  }

  /** Inserta como línea virtual lo que sobró tras una palabra clave. */
  private pushRest(rest: string, line: number) {
    const t = rest.trim();
    if (t) this.lines.splice(this.pos, 0, { text: t, norm: maskedNorm(t), line });
  }

  private parseStatement(): Stmt {
    const L = this.lines[this.pos];
    const { text, norm, line } = L;
    let m: RegExpExecArray | null;

    if ((m = /^definir\s+/.exec(norm))) {
      const rest = norm.slice(m[0].length);
      const cm = /\s+como\s+(.+)$/.exec(rest);
      if (!cm) throw new PseError("Falta el tipo en «Definir» (por ejemplo: Definir x Como Entero).", line);
      const names = splitTopLevel(text.slice(m[0].length, m[0].length + cm.index), rest.slice(0, cm.index));
      const t = cm[1].trim();
      const type: VarType | null = /^(entero|real|numero|numerico)$/.test(t)
        ? "num"
        : /^(caracter|texto|cadena)$/.test(t)
          ? "str"
          : /^logico$/.test(t)
            ? "bool"
            : null;
      if (!type) throw new PseError(`Tipo de dato desconocido: «${cm[1].trim()}».`, line);
      this.pos++;
      return { k: "define", names: names.map(deaccent), type, line };
    }

    if ((m = /^dimension(ar)?\s+/.exec(norm))) {
      const body = text.slice(m[0].length);
      const arrays = splitTopLevel(body, norm.slice(m[0].length)).map((part) => {
        const pm = new RegExp(`^(${ID_RE})\\s*[\\[(](.*)[\\])]$`).exec(maskedNorm(part));
        if (!pm) throw new PseError(`Dimension no válida: «${part}». Usa nombre[tamaño].`, line);
        const raw = part.match(/^[^\s[(]+/)![0];
        const inner = part.slice(part.search(/[[(]/) + 1, -1);
        const dims = splitTopLevel(inner, maskedNorm(inner)).map((d) => parseExpr(d, line));
        return { name: pm[1], raw, dims };
      });
      this.pos++;
      return { k: "dim", arrays, line };
    }

    if ((m = /^(escribir|mostrar|imprimir)\b\s*/.exec(norm))) {
      let body = text.slice(m[0].length);
      let nrm = norm.slice(m[0].length);
      let newline = true;
      const pre = /^sin\s+(saltar|bajar)\b\s*/.exec(nrm);
      if (pre) {
        newline = false;
        body = body.slice(pre[0].length);
        nrm = nrm.slice(pre[0].length);
      }
      const post = /\s+sin\s+(saltar|bajar)\s*$/.exec(nrm);
      if (post) {
        newline = false;
        body = body.slice(0, post.index);
        nrm = nrm.slice(0, post.index);
      }
      const args = splitTopLevel(body, nrm).map((a) => parseExpr(a, line));
      this.pos++;
      return { k: "write", args, newline, line };
    }

    if ((m = /^leer\b\s*/.exec(norm))) {
      const body = text.slice(m[0].length);
      const parts = splitTopLevel(body, norm.slice(m[0].length));
      if (parts.length === 0) throw new PseError("«Leer» necesita al menos una variable.", line);
      this.pos++;
      return { k: "read", targets: parts.map((p) => this.parseLValue(p, line)), line };
    }

    if (/^(borrar|limpiar)\s+pantalla\b/.test(norm) || /^esperar\b/.test(norm)) {
      this.pos++;
      return { k: "noop", line };
    }

    if ((m = /^retornar\b\s*(.*)$/.exec(norm))) {
      const expr = parseExpr(text.slice(text.length - m[1].length), line);
      this.pos++;
      return { k: "return", expr, line };
    }

    if (/^si\s/.test(norm)) return this.parseIf(L);
    if (/^mientras\s/.test(norm)) return this.parseWhile(L);
    if (/^repetir\b/.test(norm)) return this.parseRepeat(L);
    if (/^para\s/.test(norm)) return this.parseFor(L);
    if (/^segun\s/.test(norm)) return this.parseSwitch(L);

    if (
      /^(sino|si\s+no|hasta\s+que|de\s+otro\s+modo)\b/.test(norm) ||
      /^fin\s*(si|mientras|para|segun|funcion|subproceso|algoritmo|proceso)\b/.test(norm)
    ) {
      throw new PseError(`«${text.split(/\s/)[0]}» no corresponde aquí: no hay nada abierto que cerrar.`, line);
    }

    const asg = findAssign(norm);
    if (asg) {
      const target = this.parseLValue(text.slice(0, asg.i), line);
      const expr = parseExpr(text.slice(asg.i + asg.len), line);
      this.pos++;
      return { k: "assign", target, expr, line };
    }

    const cm = new RegExp(`^(${ID_RE})\\s*(\\((.*)\\))?\\s*$`).exec(norm);
    if (cm) {
      const raw = text.match(/^[^\s(]+/)![0];
      let args: Expr[] = [];
      if (cm[2]) {
        const inner = text.slice(text.indexOf("(") + 1, text.lastIndexOf(")"));
        args = splitTopLevel(inner, maskedNorm(inner)).map((a) => parseExpr(a, line));
      }
      this.pos++;
      return { k: "call", name: cm[1], raw, args, line };
    }

    throw new PseError(`No entiendo esta instrucción: «${text}».`, line);
  }

  private parseIf(L: Line): Stmt {
    const { text, norm, line } = L;
    const start = /^si\s+/.exec(norm)![0].length;
    const em = /\s+entonces\b/.exec(norm.slice(start));
    let condText: string;
    let rest = "";
    if (em) {
      condText = text.slice(start, start + em.index);
      rest = text.slice(start + em.index + em[0].length);
    } else {
      condText = text.slice(start);
    }
    const cond = parseExpr(condText, line);
    this.pos++;
    this.pushRest(rest, line);
    const then = this.parseBlock((n) => RE.sino.test(n) || RE.finSi.test(n));
    let other: Stmt[] = [];
    const cur = this.lines[this.pos];
    if (cur && RE.sino.test(cur.norm)) {
      const sm = RE.sino.exec(cur.norm)![0];
      this.pos++;
      this.pushRest(cur.text.slice(sm.length), cur.line);
      other = this.parseBlock((n) => RE.finSi.test(n));
    }
    this.expectEnd(RE.finSi, "FinSi", line);
    return { k: "if", cond, then, else: other, line };
  }

  private parseWhile(L: Line): Stmt {
    const { text, norm, line } = L;
    const start = /^mientras\s+/.exec(norm)![0].length;
    const hm = /\s+hacer\s*$/.exec(norm);
    const end = hm ? hm.index : text.length;
    const cond = parseExpr(text.slice(start, end), line);
    this.pos++;
    const body = this.parseBlock((n) => RE.finMientras.test(n));
    this.expectEnd(RE.finMientras, "FinMientras", line);
    return { k: "while", cond, body, line };
  }

  private parseRepeat(L: Line): Stmt {
    const { text, norm, line } = L;
    const rest = text.slice(/^repetir\b/.exec(norm)![0].length);
    this.pos++;
    this.pushRest(rest.replace(/^\s*(hacer)?/i, ""), line);
    const body = this.parseBlock((n) => RE.hastaQue.test(n) || RE.mientrasQue.test(n));
    const cur = this.lines[this.pos];
    if (!cur) throw new PseError("Falta «Hasta Que condición» para cerrar el «Repetir».", line);
    this.pos++;
    if (RE.hastaQue.test(cur.norm)) {
      const cond = parseExpr(cur.text.slice(RE.hastaQue.exec(cur.norm)![0].length), cur.line);
      return { k: "repeat", body, cond, line };
    }
    const cond = parseExpr(cur.text.slice(RE.mientrasQue.exec(cur.norm)![0].length), cur.line);
    return { k: "repeat", body, cond: { k: "un", op: "no", e: cond }, line };
  }

  private parseFor(L: Line): Stmt {
    const { text, norm, line } = L;
    const start = /^para\s+/.exec(norm)![0].length;
    const hm = /\s+hacer\s*$/.exec(norm);
    const endAll = hm ? hm.index : text.length;
    const bodyNorm = norm.slice(0, endAll);
    const asg = findAssign(bodyNorm.slice(start));
    if (!asg) throw new PseError("En «Para» falta la asignación (por ejemplo: Para i <- 1 Hasta 10).", line);
    const target = this.parseLValue(text.slice(start, start + asg.i), line);
    const afterAsg = start + asg.i + asg.len;
    const hasta = /\s+hasta\s+/.exec(bodyNorm.slice(afterAsg));
    if (!hasta) throw new PseError("En «Para» falta la palabra «Hasta».", line);
    const fromText = text.slice(afterAsg, afterAsg + hasta.index);
    const toStart = afterAsg + hasta.index + hasta[0].length;
    const paso = /\s+con\s+paso\s+/.exec(bodyNorm.slice(toStart));
    const toText = text.slice(toStart, paso ? toStart + paso.index : endAll);
    const stepText = paso ? text.slice(toStart + paso.index + paso[0].length, endAll) : null;
    this.pos++;
    const body = this.parseBlock((n) => RE.finPara.test(n));
    this.expectEnd(RE.finPara, "FinPara", line);
    return {
      k: "for",
      target,
      from: parseExpr(fromText, line),
      to: parseExpr(toText, line),
      step: stepText ? parseExpr(stepText, line) : null,
      body,
      line,
    };
  }

  private parseSwitch(L: Line): Stmt {
    const { text, norm, line } = L;
    const start = /^segun\s+/.exec(norm)![0].length;
    const hm = /\s+hacer\s*$/.exec(norm);
    const subject = parseExpr(text.slice(start, hm ? hm.index : text.length), line);
    this.pos++;
    const cases: { values: Expr[]; body: Stmt[] }[] = [];
    let other: Stmt[] = [];
    const isLabel = (n: string) => findCaseColon(n) > 0;
    const stopBody = (n: string) => RE.finSegun.test(n) || RE.deOtroModo.test(n) || isLabel(n);
    while (this.pos < this.lines.length && !RE.finSegun.test(this.lines[this.pos].norm)) {
      const cur = this.lines[this.pos];
      if (RE.deOtroModo.test(cur.norm)) {
        const dm = RE.deOtroModo.exec(cur.norm)![0];
        this.pos++;
        this.pushRest(cur.text.slice(dm.length).replace(/^\s*:/, ""), cur.line);
        other = this.parseBlock(stopBody);
        continue;
      }
      const ci = findCaseColon(cur.norm);
      if (ci <= 0) {
        throw new PseError("Dentro de «Segun» se esperaba un caso, por ejemplo «1:» o «De Otro Modo:».", cur.line);
      }
      const labels = cur.text.slice(0, ci);
      const values = splitTopLevel(labels, cur.norm.slice(0, ci)).map((v) => parseExpr(v, cur.line));
      this.pos++;
      this.pushRest(cur.text.slice(ci + 1), cur.line);
      cases.push({ values, body: this.parseBlock(stopBody) });
    }
    this.expectEnd(RE.finSegun, "FinSegun", line);
    return { k: "switch", subject, cases, other, line };
  }
}

// ------------------------------------------------------------------ Ejecución

class Scope {
  vars = new Map<string, Slot>();
  types = new Map<string, VarType>();
}

const BUILTINS: Record<
  string,
  (a: Value[], fail: (m: string) => never, rng: () => number) => Value
> = {};

function num(v: Value | undefined, fail: (m: string) => never): number {
  if (typeof v === "number") return v;
  return fail("Se esperaba un número, pero hay un texto o un valor lógico.");
}
function str(v: Value | undefined, fail: (m: string) => never): string {
  if (typeof v === "string") return v;
  return fail("Se esperaba un texto.");
}

function defineBuiltins() {
  const b = BUILTINS;
  const n1 = (name: string, f: (x: number) => number, check?: (x: number) => string | null) => {
    b[name] = (a, fail) => {
      if (a.length !== 1) fail(`«${name}» necesita 1 valor.`);
      const x = num(a[0], fail);
      const err = check?.(x);
      if (err) fail(err);
      return f(x);
    };
  };
  n1("raiz", Math.sqrt, (x) => (x < 0 ? "No se puede sacar la raíz de un número negativo." : null));
  n1("rc", Math.sqrt, (x) => (x < 0 ? "No se puede sacar la raíz de un número negativo." : null));
  n1("abs", Math.abs);
  n1("trunc", Math.trunc);
  n1("redon", Math.round);
  n1("seno", Math.sin);
  n1("sen", Math.sin);
  n1("coseno", Math.cos);
  n1("cos", Math.cos);
  n1("tan", Math.tan);
  n1("asen", Math.asin);
  n1("acos", Math.acos);
  n1("atan", Math.atan);
  n1("exp", Math.exp);
  n1("ln", Math.log, (x) => (x <= 0 ? "El logaritmo solo existe para números mayores que 0." : null));
  b.azar = (a, fail, rng) => Math.floor(rng() * num(a[0], fail));
  b.aleatorio = (a, fail, rng) => {
    const lo = num(a[0], fail);
    const hi = num(a[1], fail);
    return lo + Math.floor(rng() * (hi - lo + 1));
  };
  b.longitud = (a, fail) => str(a[0], fail).length;
  b.mayusculas = (a, fail) => str(a[0], fail).toUpperCase();
  b.minusculas = (a, fail) => str(a[0], fail).toLowerCase();
  b.subcadena = (a, fail) => str(a[0], fail).slice(num(a[1], fail), num(a[2], fail) + 1);
  b.concatenar = (a) => toText(a[0]) + toText(a[1]);
  b.convertiranumero = (a, fail) => {
    const n = Number(str(a[0], fail).trim().replace(",", "."));
    if (Number.isNaN(n)) fail("Ese texto no se puede convertir a número.");
    return n;
  };
  b.convertiratexto = (a) => toText(a[0]);
}
defineBuiltins();

interface Options {
  maxSteps: number;
  maxOutput: number;
  /** Si es true, un «Leer» sin dato pendiente pausa el programa en vez de fallar. */
  interactive: boolean;
  /** Semilla de Azar/Aleatorio (misma semilla = mismos números al re-ejecutar). */
  seed: number;
}

class Interpreter {
  private out: string[] = [];
  private outLen = 0;
  private steps = 0;
  private inputPos = 0;
  private curLine = 1;
  private depth = 0;
  private rng: () => number;

  constructor(
    private prog: Program,
    private inputs: string[],
    private opts: Options,
  ) {
    this.rng = mulberry32(opts.seed);
  }

  private emit(text: string) {
    this.outLen += text.length;
    if (this.outLen > this.opts.maxOutput) this.fail("El programa escribió demasiado texto.");
    this.out.push(text);
  }

  run(): string {
    this.exec(this.prog.main!, new Scope());
    return this.out.join("");
  }
  partialOutput(): string {
    return this.out.join("");
  }

  private fail(msg: string): never {
    throw new PseError(msg, this.curLine);
  }
  private tick() {
    if (++this.steps > this.opts.maxSteps) {
      this.fail(
        "El programa lleva demasiado tiempo ejecutándose. Puede que tengas un ciclo infinito: revisa la condición de tus «Mientras» / «Repetir».",
      );
    }
  }

  private exec(stmts: Stmt[], scope: Scope) {
    for (const s of stmts) {
      this.tick();
      this.curLine = s.line;
      this.execOne(s, scope);
    }
  }

  private execOne(s: Stmt, scope: Scope) {
    const f = (m: string) => this.fail(m);
    switch (s.k) {
      case "noop":
        return;
      case "define":
        if (s.type) for (const n of s.names) scope.types.set(n, s.type);
        return;
      case "dim":
        for (const a of s.arrays) {
          const dims = a.dims.map((d) => {
            const v = num(this.eval(d, scope), f);
            if (!Number.isInteger(v) || v < 1) f(`El tamaño de «${a.raw}» debe ser un entero positivo.`);
            return v;
          });
          scope.vars.set(a.name, { dims, data: new Map() });
        }
        return;
      case "assign":
        this.assign(s.target, this.eval(s.expr, scope), scope);
        return;
      case "write": {
        let text = s.args.map((a) => toText(this.eval(a, scope))).join("");
        if (s.newline) text += "\n";
        this.emit(text);
        return;
      }
      case "read":
        for (const t of s.targets) {
          if (this.inputPos >= this.inputs.length) {
            if (this.opts.interactive) throw new InputRequired();
            f(
              `El programa pide un dato con «Leer ${t.raw}» pero ya no hay más entradas. Agrégalas en «Agregar entrada», una por línea.`,
            );
          }
          const raw = this.inputs[this.inputPos++];
          // En la consola interactiva el dato escrito queda visible, como en PSeInt.
          if (this.opts.interactive) this.emit(raw + "\n");
          this.assign(t, this.parseInput(raw, scope.types.get(t.name)), scope);
        }
        return;
      case "if":
        this.exec(this.cond(s.cond, scope) ? s.then : s.else, scope);
        return;
      case "while":
        while (this.cond(s.cond, scope)) {
          this.tick();
          this.exec(s.body, scope);
          this.curLine = s.line;
        }
        return;
      case "repeat":
        do {
          this.tick();
          this.exec(s.body, scope);
          this.curLine = s.line;
        } while (!this.cond(s.cond, scope));
        return;
      case "for": {
        const from = num(this.eval(s.from, scope), f);
        const to = num(this.eval(s.to, scope), f);
        const step = s.step ? num(this.eval(s.step, scope), f) : 1;
        if (step === 0) f("El paso del «Para» no puede ser 0.");
        let v = from;
        while (step > 0 ? v <= to : v >= to) {
          this.tick();
          this.assign(s.target, v, scope);
          this.exec(s.body, scope);
          this.curLine = s.line;
          v += step;
        }
        this.assign(s.target, v, scope);
        return;
      }
      case "switch": {
        const subject = this.eval(s.subject, scope);
        for (const c of s.cases) {
          if (c.values.some((e) => this.eval(e, scope) === subject)) {
            this.exec(c.body, scope);
            return;
          }
        }
        this.exec(s.other, scope);
        return;
      }
      case "call":
        this.callFn(s.name, s.raw, s.args, scope, true);
        return;
      case "return":
        throw new ReturnSignal(this.eval(s.expr, scope));
    }
  }

  private cond(e: Expr, scope: Scope): boolean {
    const v = this.eval(e, scope);
    if (typeof v !== "boolean") {
      this.fail("La condición debe ser una expresión lógica, por ejemplo «x > 5» o «a = b».");
    }
    return v;
  }

  private parseInput(raw: string, type: VarType | undefined): Value {
    const t = raw.trim();
    if (type === "str") return raw;
    if (type === "num") {
      const n = Number(t.replace(",", "."));
      if (t === "" || Number.isNaN(n)) this.fail(`Se esperaba un número, pero se ingresó «${raw}».`);
      return n;
    }
    if (type === "bool") {
      const d = deaccent(t);
      if (d === "verdadero" || d === "v") return true;
      if (d === "falso" || d === "f") return false;
      this.fail(`Se esperaba VERDADERO o FALSO, pero se ingresó «${raw}».`);
    }
    if (t !== "" && !Number.isNaN(Number(t.replace(",", ".")))) return Number(t.replace(",", "."));
    const d = deaccent(t);
    if (d === "verdadero") return true;
    if (d === "falso") return false;
    return raw;
  }

  private arrayKey(a: ArrayVal, raw: string, idx: Expr[], scope: Scope): string {
    if (idx.length !== a.dims.length) {
      this.fail(`«${raw}» tiene ${a.dims.length} dimensión(es) pero usaste ${idx.length} posición(es).`);
    }
    const f = (m: string) => this.fail(m);
    const pos = idx.map((e, i) => {
      const v = num(this.eval(e, scope), f);
      if (!Number.isInteger(v) || v < 1 || v > a.dims[i]) {
        this.fail(`Posición fuera del arreglo: «${raw}» tiene posiciones de 1 a ${a.dims[i]} y usaste ${fmtNum(v)}.`);
      }
      return v;
    });
    return pos.join(",");
  }

  private getArray(name: string, raw: string, scope: Scope): ArrayVal {
    const slot = scope.vars.get(name);
    if (slot && typeof slot === "object") return slot;
    return this.fail(`«${raw}» no es un arreglo. Créalo antes con «Dimension ${raw}[tamaño]».`);
  }

  private assign(t: LValue, value: Value, scope: Scope) {
    if (t.idx) {
      const a = this.getArray(t.name, t.raw, scope);
      a.data.set(this.arrayKey(a, t.raw, t.idx, scope), value);
      return;
    }
    const cur = scope.vars.get(t.name);
    if (cur && typeof cur === "object") this.fail(`«${t.raw}» es un arreglo: usa ${t.raw}[posición].`);
    scope.vars.set(t.name, value);
  }

  private eval(e: Expr, scope: Scope): Value {
    const f = (m: string) => this.fail(m);
    switch (e.k) {
      case "num":
      case "str":
      case "bool":
        return e.v;
      case "var": {
        const slot = scope.vars.get(e.name);
        if (slot === undefined) {
          if (e.name === "pi") return Math.PI;
          return f(`La variable «${e.raw}» todavía no tiene valor: asígnale uno (o léelo con «Leer») antes de usarla.`);
        }
        if (typeof slot === "object") return f(`«${e.raw}» es un arreglo: usa ${e.raw}[posición].`);
        return slot;
      }
      case "index":
        return this.readElement(e.name, e.raw, e.idx, scope);
      case "call": {
        const slot = scope.vars.get(e.name);
        if (slot && typeof slot === "object") return this.readElement(e.name, e.raw, e.args, scope);
        const v = this.callFn(e.name, e.raw, e.args, scope, false);
        if (v === undefined) return f(`«${e.raw}» no devuelve ningún valor.`);
        return v;
      }
      case "un": {
        const v = this.eval(e.e, scope);
        if (e.op === "-") return -num(v, f);
        if (typeof v !== "boolean") f("«NO» solo se puede usar con valores lógicos.");
        return !v;
      }
      case "bin":
        return this.binary(e, scope);
    }
  }

  private readElement(name: string, raw: string, idx: Expr[], scope: Scope): Value {
    const a = this.getArray(name, raw, scope);
    const v = a.data.get(this.arrayKey(a, raw, idx, scope));
    if (v === undefined) {
      this.fail(`La posición de «${raw}» que intentas leer todavía no tiene valor.`);
    }
    return v;
  }

  private binary(e: Extract<Expr, { k: "bin" }>, scope: Scope): Value {
    const f = (m: string) => this.fail(m);
    if (e.op === "and" || e.op === "or") {
      const l = this.eval(e.l, scope);
      if (typeof l !== "boolean") f("«Y» / «O» solo se pueden usar con valores lógicos.");
      if (e.op === "and" && !l) return false;
      if (e.op === "or" && l) return true;
      const r = this.eval(e.r, scope);
      if (typeof r !== "boolean") f("«Y» / «O» solo se pueden usar con valores lógicos.");
      return r;
    }
    const a = this.eval(e.l, scope);
    const b = this.eval(e.r, scope);
    switch (e.op) {
      case "+":
        if (typeof a === "string" || typeof b === "string") return toText(a) + toText(b);
        return num(a, f) + num(b, f);
      case "-":
        return num(a, f) - num(b, f);
      case "*":
        return num(a, f) * num(b, f);
      case "/": {
        const d = num(b, f);
        if (d === 0) f("División por cero.");
        return num(a, f) / d;
      }
      case "%": {
        const d = num(b, f);
        if (d === 0) f("División por cero (en MOD).");
        return num(a, f) % d;
      }
      case "^":
        return Math.pow(num(a, f), num(b, f));
      case "=":
        return a === b;
      case "<>":
        return a !== b;
      default: {
        if (typeof a !== typeof b || typeof a === "boolean") {
          f("Solo se pueden comparar con «<» o «>» dos números o dos textos.");
        }
        const x = a as number | string;
        const y = b as number | string;
        if (e.op === "<") return x < y;
        if (e.op === ">") return x > y;
        if (e.op === "<=") return x <= y;
        return x >= y;
      }
    }
  }

  private callFn(
    name: string,
    raw: string,
    argExprs: Expr[],
    scope: Scope,
    asStatement: boolean,
  ): Value | undefined {
    const def = this.prog.funcs.get(name);
    if (!def) {
      const bi = BUILTINS[name];
      if (!bi || asStatement) this.fail(`No existe la función o subproceso «${raw}».`);
      return bi(
        argExprs.map((a) => this.eval(a, scope)),
        (m) => this.fail(m),
        this.rng,
      );
    }
    if (argExprs.length !== def.params.length) {
      this.fail(`«${raw}» espera ${def.params.length} valor(es) y le pasaste ${argExprs.length}.`);
    }
    if (++this.depth > 400) this.fail("Demasiadas llamadas anidadas (¿recursión sin fin?).");
    const callee = new Scope();
    def.params.forEach((p, i) => {
      const ae = argExprs[i];
      if (ae.k === "var") {
        const slot = scope.vars.get(ae.name);
        if (slot && typeof slot === "object") {
          callee.vars.set(p.name, slot);
          return;
        }
      }
      callee.vars.set(p.name, this.eval(ae, scope));
    });
    const savedLine = this.curLine;
    let result: Value | undefined;
    try {
      this.exec(def.body, callee);
      if (def.ret) {
        const r = callee.vars.get(def.ret);
        if (r !== undefined && typeof r !== "object") result = r;
      }
    } catch (err) {
      if (err instanceof ReturnSignal) result = err.value;
      else throw err;
    } finally {
      this.depth--;
    }
    this.curLine = savedLine;
    def.params.forEach((p, i) => {
      if (!p.byRef) return;
      const ae = argExprs[i];
      const v = callee.vars.get(p.name);
      if (v === undefined || typeof v === "object") return;
      if (ae.k === "var") this.assign({ name: ae.name, raw: ae.raw, idx: null }, v, scope);
      else if (ae.k === "index" || ae.k === "call") {
        const idx = ae.k === "index" ? ae.idx : ae.args;
        this.assign({ name: ae.name, raw: ae.raw, idx }, v, scope);
      }
    });
    return result;
  }
}

// ------------------------------------------------------------------ API pública

export function runPseint(
  source: string,
  inputs: string[] = [],
  opts: Partial<Options> = {},
): PseintResult {
  const options: Options = {
    maxSteps: 3_000_000,
    maxOutput: 200_000,
    interactive: false,
    seed: Math.floor(Math.random() * 2 ** 31),
    ...opts,
  };
  let interp: Interpreter | null = null;
  try {
    const prog = new Parser(splitStatements(source)).parseProgram();
    interp = new Interpreter(prog, inputs, options);
    const stdout = interp.run();
    return { ok: true, stdout: stdout.replace(/\n+$/, ""), error: null, waiting: false };
  } catch (e) {
    const partial = interp ? interp.partialOutput().replace(/\n+$/, "") : "";
    if (e instanceof InputRequired) {
      return { ok: true, stdout: partial, error: null, waiting: true };
    }
    if (e instanceof PseError) {
      return {
        ok: false,
        stdout: partial,
        error: `Error en la línea ${e.line}: ${e.message}`,
        waiting: false,
      };
    }
    if (e instanceof RangeError) {
      return {
        ok: false,
        stdout: partial,
        error: "Error: demasiadas llamadas anidadas (¿recursión sin fin?).",
        waiting: false,
      };
    }
    return {
      ok: false,
      stdout: partial,
      error: `Error inesperado: ${e instanceof Error ? e.message : String(e)}`,
      waiting: false,
    };
  }
}
