import { useEffect, useRef, useState, useCallback } from "react";
import { logExamEvent } from "@/services/submissions";
import type { ExamEvent } from "@/types/database";

interface ExamGuardOptions {
  submissionId: string | null;
  enabled: boolean;
  onWarning?: (event: ExamEvent, count: number) => void;
}

/**
 * Modo examen: registra (NO bloquea) cambios de pestaña, minimizado,
 * y copy/paste en `exam_logs`. Devuelve contadores para mostrar en UI.
 */
export function useExamGuard({
  submissionId,
  enabled,
  onWarning,
}: ExamGuardOptions) {
  const [exitCount, setExitCount] = useState(0);
  const [pasteCount, setPasteCount] = useState(0);
  const hiddenAt = useRef<number | null>(null);

  const record = useCallback(
    (event: ExamEvent, meta: Record<string, unknown> = {}) => {
      if (!submissionId) return;
      logExamEvent(submissionId, event, meta).catch(() => {});
    },
    [submissionId],
  );

  useEffect(() => {
    if (!enabled || !submissionId) return;

    const onVisibility = () => {
      if (document.hidden) {
        hiddenAt.current = Date.now();
        setExitCount((c) => {
          const next = c + 1;
          onWarning?.("window_hidden", next);
          return next;
        });
        record("window_hidden");
      } else {
        const durationMs = hiddenAt.current
          ? Date.now() - hiddenAt.current
          : 0;
        record("window_visible", { durationMs });
        hiddenAt.current = null;
      }
    };

    const onBlur = () => record("tab_blur");
    const onFocus = () => record("tab_focus");

    const onPaste = (e: ClipboardEvent) => {
      const chars = e.clipboardData?.getData("text")?.length ?? 0;
      setPasteCount((c) => {
        const next = c + 1;
        onWarning?.("paste", next);
        return next;
      });
      record("paste", { chars });
    };
    const onCopy = () => record("copy");

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    document.addEventListener("paste", onPaste);
    document.addEventListener("copy", onCopy);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("paste", onPaste);
      document.removeEventListener("copy", onCopy);
    };
  }, [enabled, submissionId, record, onWarning]);

  return { exitCount, pasteCount };
}
