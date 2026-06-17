import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useState } from "react";
import { ShieldCheck, Check, X, Inbox, Library, LineChart } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { CatalogManager } from "@/components/admin/CatalogManager";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/common/EmptyState";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import {
  fetchPendingTeacherRequests,
  reviewTeacherRequest,
  setCoordinator,
} from "@/services/admin";
import { initials } from "@/lib/utils";

export function AdminPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data, isLoading } = useQuery({
    queryKey: ["teacher-requests", "pending"],
    queryFn: fetchPendingTeacherRequests,
  });

  const review = useMutation({
    mutationFn: ({ id, approve }: { id: string; approve: boolean }) =>
      reviewTeacherRequest(id, approve),
    onSuccess: (_d, vars) => {
      toast(
        vars.approve ? "Profesor aprobado ✅" : "Solicitud rechazada",
        vars.approve ? "success" : "info",
      );
      qc.invalidateQueries({ queryKey: ["teacher-requests", "pending"] });
    },
    onError: (e) =>
      toast(e instanceof Error ? e.message : "Error", "error"),
  });

  return (
    <div>
      <PageHeader
        title="Administración"
        subtitle="Aprueba profesores y gestiona el catálogo académico."
      />

      {/* Catálogo: Facultad → Carrera → Asignatura */}
      <div className="mb-3 flex items-center gap-2 text-sm font-bold">
        <Library className="size-4 text-primary" />
        Catálogo académico
      </div>
      <div className="mb-8">
        <CatalogManager />
      </div>

      {/* Coordinador(a) de tutoría */}
      <div className="mb-3 flex items-center gap-2 text-sm font-bold">
        <LineChart className="size-4 text-primary" />
        Coordinación de tutoría
      </div>
      <div className="mb-8">
        <AssignCoordinator />
      </div>

      <div className="mb-3 flex items-center gap-2 text-sm font-bold">
        <ShieldCheck className="size-4 text-primary" />
        Solicitudes de profesor pendientes
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : !data || data.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="Sin solicitudes pendientes"
          description="Cuando alguien pida ser profesor, aparecerá aquí para que apruebes o rechaces."
        />
      ) : (
        <div className="space-y-3">
          {data.map((r, i) => (
            <motion.div
              key={r.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card className="flex items-center gap-3 p-4">
                <Avatar className="size-10">
                  <AvatarFallback>{initials(r.full_name)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">
                    {r.full_name ?? "Sin nombre"}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {r.email}
                  </p>
                  {r.note && (
                    <p className="mt-1 line-clamp-2 text-xs italic text-muted-foreground">
                      “{r.note}”
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button
                    size="icon"
                    variant="outline"
                    className="size-9"
                    disabled={review.isPending}
                    onClick={() =>
                      review.mutate({ id: r.id, approve: false })
                    }
                    aria-label="Rechazar"
                  >
                    <X className="size-4 text-destructive" />
                  </Button>
                  <Button
                    size="icon"
                    variant="brand"
                    className="size-9"
                    disabled={review.isPending}
                    onClick={() => review.mutate({ id: r.id, approve: true })}
                    aria-label="Aprobar"
                  >
                    <Check className="size-4" />
                  </Button>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

function AssignCoordinator() {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  const run = async (value: boolean) => {
    if (!email.trim()) return;
    setBusy(true);
    try {
      await setCoordinator(email.trim(), value);
      toast(
        value ? "Coordinador(a) asignado ✅" : "Rol de coordinador quitado",
        value ? "success" : "info",
      );
      setEmail("");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Error", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-4">
      <p className="mb-2 text-sm text-muted-foreground">
        Escribe el correo de la cuenta y nómbrala coordinador(a) de tutoría
        (verá estadísticas y reportes de todos los grupos y estudiantes).
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          type="email"
          placeholder="correo@uniguajira.edu.co"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <div className="flex gap-2">
          <Button variant="brand" disabled={busy} onClick={() => run(true)}>
            Nombrar
          </Button>
          <Button variant="outline" disabled={busy} onClick={() => run(false)}>
            Quitar
          </Button>
        </div>
      </div>
    </Card>
  );
}
