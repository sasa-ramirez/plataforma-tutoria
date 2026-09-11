import { useEffect, useRef, useState } from "react";
import { Download } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/common/Spinner";
import { useToast } from "@/components/ui/toast";

/**
 * Vista previa del .docx real (mismo documento que se descarga) dentro de
 * la app, usando docx-preview (carga bajo demanda). No reemplaza la
 * descarga directa — es una opción aparte para ver el resultado antes de
 * bajarlo o abrirlo en Word.
 */
export function DocxPreviewDialog({
  open,
  onOpenChange,
  title,
  filename,
  getDocx,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  filename: string;
  getDocx: () => Promise<ArrayBuffer>;
}) {
  const { toast } = useToast();
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const [buffer, setBuffer] = useState<ArrayBuffer | null>(null);

  // Ref para no relanzar la generación en cada re-render del padre
  // mientras el diálogo está abierto — solo debe correr una vez por
  // apertura (ver el `[open]` como única dependencia abajo).
  const getDocxRef = useRef(getDocx);
  getDocxRef.current = getDocx;

  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    setBuffer(null);

    (async () => {
      try {
        const [buf, docxPreview] = await Promise.all([getDocxRef.current(), import("docx-preview")]);
        if (!active) return;
        setBuffer(buf);
        if (containerRef.current) {
          containerRef.current.innerHTML = "";
          await docxPreview.renderAsync(buf.slice(0), containerRef.current, containerRef.current, {
            inWrapper: true,
            breakPages: true,
            renderHeaders: true,
            renderFooters: true,
          });
        }
      } catch (e) {
        if (active) toast(e instanceof Error ? e.message : "No se pudo generar la vista previa", "error");
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [open, toast]);

  const download = () => {
    if (!buffer) return;
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Así se ve el documento real. La firma queda en blanco para firmar a mano.
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
            <Spinner className="size-4" /> Generando vista previa…
          </div>
        )}

        <div
          ref={containerRef}
          className="overflow-x-auto rounded-xl border bg-muted/30 [&_.docx-wrapper]:bg-transparent [&_.docx-wrapper]:p-0 [&_section.docx]:mx-auto [&_section.docx]:my-3 [&_section.docx]:shadow-md"
        />

        <Button variant="brand" className="w-full" onClick={download} disabled={!buffer}>
          <Download className="size-4" /> Descargar Word
        </Button>
      </DialogContent>
    </Dialog>
  );
}
