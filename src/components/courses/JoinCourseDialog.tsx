import { useState } from "react";
import { Plus } from "lucide-react";
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
import { Spinner } from "@/components/common/Spinner";
import { useToast } from "@/components/ui/toast";
import { useJoinCourse } from "@/hooks/useCourses";

export function JoinCourseDialog() {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const { mutateAsync, isPending } = useJoinCourse();
  const { toast } = useToast();

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const course = await mutateAsync(code);
      toast(`Te uniste a "${course.title}" 🎉`, "success");
      setOpen(false);
      setCode("");
    } catch (err) {
      toast(err instanceof Error ? err.message : "No se pudo unir", "error");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="brand" size="sm">
          <Plus className="size-4" /> Unirme
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Unirme a un curso</DialogTitle>
          <DialogDescription>
            Escribe el código que te dio tu profesor.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="code">Código del curso</Label>
            <Input
              id="code"
              placeholder="Ej. A1B2C3"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              className="text-center font-mono text-lg tracking-[0.3em]"
              maxLength={6}
              required
              autoFocus
            />
          </div>

          <Button
            type="submit"
            variant="brand"
            className="w-full"
            disabled={isPending || code.length < 4}
          >
            {isPending ? <Spinner className="size-4" /> : "Unirme al curso"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
