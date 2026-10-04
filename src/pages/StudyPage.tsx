import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { BookOpenCheck, ChevronRight, FileText, Lock, Plus } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { Spinner } from "@/components/common/Spinner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { useStudySpaces, useCreateStudySpace } from "@/hooks/useStudy";

/** Lista de materias de estudio del estudiante (cada una agrupa sus PDFs/PowerPoints). */
export function StudyPage() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { data: spaces, isLoading } = useStudySpaces();
  const { mutateAsync: create, isPending } = useCreateStudySpace();
  const [title, setTitle] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    try {
      const space = await create(title);
      setTitle("");
      navigate(`/app/study/${space.id}`);
    } catch (err) {
      toast(err instanceof Error ? err.message : "No se pudo crear la materia", "error");
    }
  };

  return (
    <div>
      <PageHeader
        title="Estudiar"
        subtitle="Sube tus presentaciones y apuntes; Kodea los convierte en notas por tema."
      />

      <form onSubmit={submit} className="mb-4 flex gap-2">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Nueva materia (ej.: Cálculo II)"
          maxLength={120}
          aria-label="Nombre de la materia"
        />
        <Button type="submit" variant="brand" disabled={isPending || !title.trim()}>
          {isPending ? <Spinner className="size-4" /> : <Plus className="size-4" />}
          Crear
        </Button>
      </form>

      <p className="mb-4 flex items-start gap-1.5 text-xs text-muted-foreground">
        <Lock className="mt-0.5 size-3.5 shrink-0" />
        Es privado: solo tú ves tus materias. No guardamos tus archivos, solo las notas que salen de ellos.
      </p>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : !spaces || spaces.length === 0 ? (
        <EmptyState
          icon={BookOpenCheck}
          title="Aún no tienes materias"
          description="Crea una, por ejemplo el nombre de tu curso, y sube ahí tus PDF o PowerPoint."
        />
      ) : (
        <div className="space-y-3">
          {spaces.map((s, i) => (
            <motion.div
              key={s.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
            >
              <Link to={`/app/study/${s.id}`}>
                <Card className="card-interactive flex items-center gap-3 p-4">
                  <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                    <BookOpenCheck className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{s.title}</p>
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <FileText className="size-3" />
                      {s.doc_count ?? 0} documento{s.doc_count === 1 ? "" : "s"}
                    </p>
                  </div>
                  <ChevronRight className="size-4 text-muted-foreground" />
                </Card>
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
