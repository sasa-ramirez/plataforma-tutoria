import { useState } from "react";
import { Plus, Trash2, ChevronRight, Building2, GraduationCap, BookOpen } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/common/Spinner";
import { useToast } from "@/components/ui/toast";
import {
  useFaculties,
  useCareers,
  useSubjects,
  useCreateFaculty,
  useCreateCareer,
  useCreateSubject,
  useDeleteFaculty,
  useDeleteCareer,
  useDeleteSubject,
} from "@/hooks/useCatalog";
import { cn } from "@/lib/utils";

interface Item {
  id: string;
  name: string;
}

/** Lista editable: agregar (input) + items con seleccionar/borrar. */
function EditableList({
  title,
  icon: Icon,
  items,
  loading,
  selectedId,
  onSelect,
  onAdd,
  onDelete,
  adding,
  placeholder,
  emptyHint,
}: {
  title: string;
  icon: typeof Building2;
  items: Item[];
  loading: boolean;
  selectedId?: string;
  onSelect?: (id: string) => void;
  onAdd: (name: string) => void;
  onDelete: (id: string) => void;
  adding: boolean;
  placeholder: string;
  emptyHint: string;
}) {
  const [name, setName] = useState("");
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onAdd(name.trim());
    setName("");
  };

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center gap-1.5 text-sm font-bold">
          <Icon className="size-4 text-primary" /> {title}
        </div>

        <form onSubmit={submit} className="flex gap-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={placeholder}
            className="h-9"
          />
          <Button type="submit" size="sm" variant="brand" disabled={adding}>
            {adding ? <Spinner className="size-4" /> : <Plus className="size-4" />}
          </Button>
        </form>

        {loading ? (
          <p className="py-2 text-xs text-muted-foreground">Cargando…</p>
        ) : items.length === 0 ? (
          <p className="py-2 text-xs text-muted-foreground">{emptyHint}</p>
        ) : (
          <ul className="space-y-1">
            {items.map((it) => (
              <li
                key={it.id}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm",
                  onSelect && "cursor-pointer hover:bg-muted",
                  selectedId === it.id && "bg-primary/10 ring-1 ring-primary/30",
                )}
                onClick={() => onSelect?.(it.id)}
              >
                <span className="min-w-0 flex-1 truncate">{it.name}</span>
                {onSelect && <ChevronRight className="size-4 text-muted-foreground" />}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm(`¿Eliminar "${it.name}"? Se borra todo lo que cuelga de él.`))
                      onDelete(it.id);
                  }}
                  className="shrink-0 rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  aria-label="Eliminar"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export function CatalogManager() {
  const { toast } = useToast();
  const [facultyId, setFacultyId] = useState("");
  const [careerId, setCareerId] = useState("");

  const faculties = useFaculties();
  const careers = useCareers(facultyId);
  const subjects = useSubjects(careerId);

  const addFaculty = useCreateFaculty();
  const addCareer = useCreateCareer(facultyId);
  const addSubject = useCreateSubject(careerId);
  const delFaculty = useDeleteFaculty();
  const delCareer = useDeleteCareer(facultyId);
  const delSubject = useDeleteSubject(careerId);

  const err = (e: unknown) =>
    toast(e instanceof Error ? e.message : "Error", "error");

  return (
    <div className="space-y-3">
      <EditableList
        title="Facultades"
        icon={Building2}
        items={faculties.data ?? []}
        loading={faculties.isLoading}
        selectedId={facultyId}
        onSelect={(id) => {
          setFacultyId(id);
          setCareerId("");
        }}
        onAdd={(name) =>
          addFaculty.mutate(name, {
            onError: err,
            onSuccess: () => toast("Facultad creada", "success"),
          })
        }
        onDelete={(id) => delFaculty.mutate(id, { onError: err })}
        adding={addFaculty.isPending}
        placeholder="Nueva facultad"
        emptyHint="Aún no hay facultades."
      />

      {facultyId && (
        <EditableList
          title="Carreras"
          icon={GraduationCap}
          items={careers.data ?? []}
          loading={careers.isLoading}
          selectedId={careerId}
          onSelect={setCareerId}
          onAdd={(name) =>
            addCareer.mutate(name, {
              onError: err,
              onSuccess: () => toast("Carrera creada", "success"),
            })
          }
          onDelete={(id) => delCareer.mutate(id, { onError: err })}
          adding={addCareer.isPending}
          placeholder="Nueva carrera"
          emptyHint="Esta facultad no tiene carreras."
        />
      )}

      {careerId && (
        <EditableList
          title="Asignaturas"
          icon={BookOpen}
          items={subjects.data ?? []}
          loading={subjects.isLoading}
          onAdd={(name) =>
            addSubject.mutate(name, {
              onError: err,
              onSuccess: () => toast("Asignatura creada", "success"),
            })
          }
          onDelete={(id) => delSubject.mutate(id, { onError: err })}
          adding={addSubject.isPending}
          placeholder="Nueva asignatura"
          emptyHint="Esta carrera no tiene asignaturas."
        />
      )}
    </div>
  );
}
