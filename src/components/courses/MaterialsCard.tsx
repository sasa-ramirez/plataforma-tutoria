import { useState, useRef } from "react";
import {
  BookOpen,
  Plus,
  FileText,
  Presentation,
  Link2,
  Trash2,
  ExternalLink,
  Upload,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/common/Spinner";
import { useToast } from "@/components/ui/toast";
import {
  useMaterials,
  useAddMaterialFile,
  useAddMaterialLink,
  useDeleteMaterial,
} from "@/hooks/useMaterials";
import { fetchMaterialFileUrl, type CourseMaterial } from "@/services/materials";
import { cn } from "@/lib/utils";

const MAX_FILE_MB = 25;

function materialIcon(m: CourseMaterial) {
  if (m.kind === "link") return Link2;
  if (m.mime_type?.includes("presentation")) return Presentation;
  return FileText;
}

function formatSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function MaterialsCard({
  courseId,
  isTeacher,
}: {
  courseId: string;
  isTeacher: boolean;
}) {
  const { toast } = useToast();
  const { data: materials, isLoading } = useMaterials(courseId);
  const { mutateAsync: remove, isPending: removing } = useDeleteMaterial(courseId);
  const [openingId, setOpeningId] = useState<string | null>(null);

  const openMaterial = async (m: CourseMaterial) => {
    setOpeningId(m.id);
    try {
      const url = m.kind === "link" ? m.url! : await fetchMaterialFileUrl(m.storage_path!);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast(e instanceof Error ? e.message : "No se pudo abrir", "error");
    } finally {
      setOpeningId(null);
    }
  };

  const handleDelete = async (m: CourseMaterial) => {
    if (!window.confirm(`¿Eliminar "${m.title}"?`)) return;
    try {
      await remove(m);
      toast("Material eliminado", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "No se pudo eliminar", "error");
    }
  };

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-base font-bold">
            <BookOpen className="size-4 text-primary" /> Materiales educativos
          </div>
          {isTeacher && <NewMaterialDialog courseId={courseId} />}
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : !materials || materials.length === 0 ? (
          <p className="py-2 text-xs text-muted-foreground">
            {isTeacher
              ? "Sube PDF, Word, PowerPoint o enlaces para que estudien."
              : "Tu tutor todavía no sube materiales para este curso."}
          </p>
        ) : (
          <div className="space-y-1.5">
            {materials.map((m) => {
              const Icon = materialIcon(m);
              return (
                <div
                  key={m.id}
                  className="flex items-center gap-3 rounded-xl border px-3 py-2.5"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{m.title}</p>
                    {m.description && (
                      <p className="truncate text-xs text-muted-foreground">
                        {m.description}
                      </p>
                    )}
                    {m.kind === "file" && m.size_bytes && (
                      <p className="text-[11px] text-muted-foreground/70">
                        {formatSize(m.size_bytes)}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => openMaterial(m)}
                    disabled={openingId === m.id}
                    className="shrink-0 rounded-lg p-2 text-muted-foreground hover:bg-muted disabled:opacity-50"
                    aria-label={`Abrir ${m.title}`}
                  >
                    {openingId === m.id ? (
                      <Spinner className="size-4" />
                    ) : (
                      <ExternalLink className="size-4" />
                    )}
                  </button>
                  {isTeacher && (
                    <button
                      onClick={() => handleDelete(m)}
                      disabled={removing}
                      className="shrink-0 rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                      aria-label={`Eliminar ${m.title}`}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function NewMaterialDialog({ courseId }: { courseId: string }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<"file" | "link">("file");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { mutateAsync: addFile, isPending: addingFile } = useAddMaterialFile(courseId);
  const { mutateAsync: addLink, isPending: addingLink } = useAddMaterialLink(courseId);
  const pending = addingFile || addingLink;

  const reset = () => {
    setKind("file");
    setTitle("");
    setDescription("");
    setFile(null);
    setUrl("");
  };

  const pickFile = (f: File | null) => {
    if (f && f.size > MAX_FILE_MB * 1024 * 1024) {
      toast(`El archivo pesa más de ${MAX_FILE_MB} MB. Sube uno más liviano.`, "error");
      return;
    }
    setFile(f);
    if (f && !title.trim()) setTitle(f.name.replace(/\.[^.]+$/, ""));
  };

  const submit = async () => {
    if (!title.trim()) {
      toast("Ponle un título.", "error");
      return;
    }
    try {
      if (kind === "file") {
        if (!file) {
          toast("Elige un archivo.", "error");
          return;
        }
        await addFile({ courseId, title, description, file });
      } else {
        if (!/^https?:\/\//i.test(url.trim())) {
          toast("El enlace debe empezar con http:// o https://", "error");
          return;
        }
        await addLink({ courseId, title, description, url });
      }
      toast("Material agregado", "success");
      setOpen(false);
      reset();
    } catch (e) {
      toast(e instanceof Error ? e.message : "No se pudo agregar", "error");
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="brand">
          <Plus className="size-4" /> Nuevo material
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nuevo material educativo</DialogTitle>
          <DialogDescription>
            Súbelo aquí y tus estudiantes lo ven en este curso, para estudiar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted/50 p-1">
            {(["file", "link"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={cn(
                  "rounded-lg py-2 text-sm font-semibold transition-colors",
                  kind === k ? "bg-card text-foreground shadow" : "text-muted-foreground",
                )}
              >
                {k === "file" ? "Archivo" : "Enlace"}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            <Label htmlFor="mat-title">Título</Label>
            <Input
              id="mat-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej. Guía de derivadas"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="mat-desc">Descripción (opcional)</Label>
            <Textarea
              id="mat-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-[60px] text-sm"
            />
          </div>

          {kind === "file" ? (
            <div className="space-y-2">
              <Label>Archivo (PDF, Word o PowerPoint, máx. {MAX_FILE_MB} MB)</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.ppt,.pptx"
                className="hidden"
                onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
              />
              {file ? (
                <div className="flex items-center justify-between rounded-xl border px-3 py-2 text-sm">
                  <span className="truncate">{file.name}</span>
                  <button
                    type="button"
                    onClick={() => pickFile(null)}
                    className="shrink-0 text-xs font-semibold text-destructive"
                  >
                    Quitar
                  </button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="size-4" /> Elegir archivo
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="mat-url">Enlace</Label>
              <Input
                id="mat-url"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://…"
              />
            </div>
          )}

          <Button variant="brand" className="w-full" onClick={submit} disabled={pending}>
            {pending ? <Spinner className="size-4" /> : "Guardar material"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
