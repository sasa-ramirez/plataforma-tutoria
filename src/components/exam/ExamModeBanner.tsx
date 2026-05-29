import { motion } from "framer-motion";
import { ShieldAlert, Eye, ClipboardPaste } from "lucide-react";

export function ExamModeBanner({
  exitCount,
  pasteCount,
}: {
  exitCount: number;
  pasteCount: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2.5"
    >
      <div className="flex items-center gap-2 text-sm font-semibold text-destructive">
        <ShieldAlert className="size-4" /> Modo examen activo
      </div>
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Eye className="size-3.5" /> {exitCount} salidas
        </span>
        <span className="flex items-center gap-1">
          <ClipboardPaste className="size-3.5" /> {pasteCount} pegados
        </span>
      </div>
    </motion.div>
  );
}
