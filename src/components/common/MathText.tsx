import { useMemo } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";

/**
 * Renderiza texto con fórmulas matemáticas. Usa $...$ para fórmula en línea
 * y $$...$$ para fórmula en bloque (sintaxis LaTeX). El resto se muestra tal
 * cual (con saltos de línea). Escapa el HTML del texto plano por seguridad.
 */
export function MathText({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  const html = useMemo(() => renderMath(children ?? ""), [children]);
  return (
    <span
      className={className}
      style={{ whiteSpace: "pre-wrap" }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function renderMath(text: string): string {
  const re = /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g;
  let out = "";
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    out += escapeHtml(text.slice(last, m.index));
    const display = m[1] != null;
    const expr = display ? m[1] : m[2];
    try {
      out += katex.renderToString(expr, {
        displayMode: display,
        throwOnError: false,
      });
    } catch {
      out += escapeHtml(m[0]);
    }
    last = re.lastIndex;
  }
  out += escapeHtml(text.slice(last));
  return out;
}
