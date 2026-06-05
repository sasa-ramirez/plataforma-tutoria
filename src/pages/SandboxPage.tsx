import { useState, useCallback } from "react";
import { PageHeader } from "@/components/common/PageHeader";
import { CodeEditor } from "@/components/editor/CodeEditor";
import { CodeRunner } from "@/components/editor/CodeRunner";
import { LANGUAGE_META, STARTER_CODE } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { ProgLanguage } from "@/types/database";

const LANGS = Object.keys(LANGUAGE_META) as ProgLanguage[];

// ¿El código actual sigue siendo una plantilla sin tocar? (para reemplazar sin preguntar)
function isUntouchedTemplate(code: string): boolean {
  const c = code.trim();
  if (!c) return true;
  return Object.values(STARTER_CODE).some((t) => t.trim() === c);
}

export function SandboxPage() {
  const [lang, setLang] = useState<ProgLanguage>("python");
  const [code, setCode] = useState(STARTER_CODE.python);

  const pickLang = useCallback(
    (next: ProgLanguage) => {
      if (next === lang) return;
      // Si no escribió nada propio, cargamos la plantilla del nuevo lenguaje.
      if (isUntouchedTemplate(code)) {
        setCode(STARTER_CODE[next]);
      } else {
        const ok = window.confirm(
          `¿Cambiar a ${LANGUAGE_META[next].label} y cargar su código base? Se reemplazará lo que escribiste.`,
        );
        if (ok) setCode(STARTER_CODE[next]);
      }
      setLang(next);
    },
    [lang, code],
  );

  const reset = useCallback(() => setCode(STARTER_CODE[lang]), [lang]);

  return (
    <div>
      <PageHeader
        title="Editor libre"
        subtitle="Elige un lenguaje, te damos el código base y practicas desde cero."
      />

      {/* Selector de lenguaje */}
      <div className="mb-3 flex flex-wrap gap-2">
        {LANGS.map((l) => (
          <button
            key={l}
            onClick={() => pickLang(l)}
            className={cn(
              "flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-semibold transition-colors",
              lang === l
                ? "bg-primary/15 text-primary ring-1 ring-primary/40"
                : "bg-muted text-muted-foreground hover:bg-muted/70",
            )}
          >
            <span>{LANGUAGE_META[l].emoji}</span>
            {LANGUAGE_META[l].label}
          </button>
        ))}
      </div>

      <CodeEditor
        value={code}
        onChange={setCode}
        language={lang}
        onReset={reset}
      />

      <div className="mt-3">
        <CodeRunner language={lang} code={code} />
      </div>
    </div>
  );
}
