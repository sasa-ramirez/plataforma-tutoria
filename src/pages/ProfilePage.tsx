import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Flame,
  Trophy,
  LogOut,
  Mail,
  GraduationCap,
  Clock,
  IdCard,
  Check,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { Spinner } from "@/components/common/Spinner";
import { fetchMyTeacherRequest, requestTeacherRole } from "@/services/admin";
import { updateInstitutionalData } from "@/services/profile";
import { Achievements } from "@/components/game/Achievements";
import { cn, initials } from "@/lib/utils";
import type { PriorityGroup, Profile } from "@/types/database";

const PRIORITY_GROUPS: { value: PriorityGroup; label: string }[] = [
  { value: "indigena", label: "Indígena" },
  { value: "afro", label: "Afrodescendiente" },
  { value: "discapacidad", label: "Discapacidad" },
  { value: "victima", label: "Víctima de conflicto armado" },
  { value: "lgbtiq", label: "Comunidad LGBTIQ+" },
  { value: "frontera", label: "Habitante de frontera" },
];

export function ProfilePage() {
  const { profile, signOut, isTeacher, isAdmin } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const qc = useQueryClient();

  // Solo a estudiantes (no profesores ni admins) les ofrecemos solicitar.
  const canRequest = !isTeacher && !isAdmin;
  const { data: myRequest, isLoading: reqLoading } = useQuery({
    queryKey: ["my-teacher-request"],
    queryFn: fetchMyTeacherRequest,
    enabled: canRequest,
  });

  const request = useMutation({
    mutationFn: () => requestTeacherRole(),
    onSuccess: () => {
      toast("Solicitud enviada. Un admin la revisará.", "success");
      qc.invalidateQueries({ queryKey: ["my-teacher-request"] });
    },
    onError: (e) => toast(e instanceof Error ? e.message : "Error", "error"),
  });

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <div>
      <PageHeader title="Perfil" />

      <Card>
        <CardContent className="flex flex-col items-center gap-4 p-6 text-center">
          <Avatar className="size-20">
            <AvatarImage src={profile?.avatar_url ?? undefined} />
            <AvatarFallback className="text-xl">
              {initials(profile?.full_name)}
            </AvatarFallback>
          </Avatar>
          <div>
            <h2 className="text-xl font-extrabold">{profile?.full_name}</h2>
            <p className="flex items-center justify-center gap-1 text-sm text-muted-foreground">
              <Mail className="size-3.5" /> {profile?.email}
            </p>
          </div>
          <Badge variant="secondary" className="capitalize">
            {profile?.role === "teacher" ? "Profesor" : "Estudiante"}
          </Badge>

          <div className="grid w-full grid-cols-2 gap-3 pt-2">
            <div className="rounded-xl bg-warning/10 p-4">
              <Flame className="mx-auto mb-1 size-5 text-warning" />
              <p className="text-xl font-extrabold">{profile?.streak ?? 0}</p>
              <p className="text-xs text-muted-foreground">días de racha</p>
            </div>
            <div className="rounded-xl bg-primary/10 p-4">
              <Trophy className="mx-auto mb-1 size-5 text-primary" />
              <p className="text-xl font-extrabold">{profile?.xp ?? 0}</p>
              <p className="text-xs text-muted-foreground">XP total</p>
            </div>
          </div>

          <Button
            variant="outline"
            className="mt-2 w-full"
            onClick={handleSignOut}
          >
            <LogOut className="size-4" /> Cerrar sesión
          </Button>
        </CardContent>
      </Card>

      {/* Datos institucionales (cédula, código, sexo, grupo priorizado) */}
      {!isTeacher && profile && <InstitutionalDataCard profile={profile} />}

      {/* Solicitud para ser profesor */}
      {canRequest && (
        <Card className="mt-4">
          <CardContent className="p-5">
            <div className="mb-2 flex items-center gap-2 font-bold">
              <GraduationCap className="size-5 text-primary" />
              ¿Eres docente?
            </div>
            {reqLoading ? (
              <Spinner className="size-4" />
            ) : myRequest?.status === "pending" ? (
              <Badge variant="warning">
                <Clock className="mr-1 size-3" /> Solicitud pendiente de
                aprobación
              </Badge>
            ) : myRequest?.status === "rejected" ? (
              <>
                <Badge variant="destructive">Solicitud rechazada</Badge>
                <Button
                  variant="outline"
                  className="mt-3 w-full"
                  disabled={request.isPending}
                  onClick={() => request.mutate()}
                >
                  Solicitar de nuevo
                </Button>
              </>
            ) : (
              <>
                <p className="mb-3 text-sm text-muted-foreground">
                  Solicita acceso de profesor para crear cursos y tareas. Un
                  administrador revisará tu solicitud.
                </p>
                <Button
                  variant="brand"
                  className="w-full"
                  disabled={request.isPending}
                  onClick={() => request.mutate()}
                >
                  {request.isPending ? (
                    <Spinner className="size-4" />
                  ) : (
                    "Solicitar ser profesor"
                  )}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Logros */}
      <div className="mt-6">
        <h2 className="mb-3 text-lg font-extrabold tracking-tight">Logros</h2>
        <Achievements />
      </div>
    </div>
  );
}

/** Cédula, código estudiantil, sexo y grupo priorizado — los pide
 * Bienestar para sus formatos y hoy no se guardaban en ningún lado. */
function InstitutionalDataCard({ profile }: { profile: Profile }) {
  const { toast } = useToast();
  const { refreshProfile } = useAuth();
  const [nationalId, setNationalId] = useState(profile.national_id ?? "");
  const [studentCode, setStudentCode] = useState(profile.student_code ?? "");
  const [sex, setSex] = useState<"F" | "M" | "">(profile.sex ?? "");
  const [priorityGroup, setPriorityGroup] = useState<PriorityGroup | "none">(
    profile.priority_group ?? "none",
  );
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await updateInstitutionalData({
        national_id: nationalId,
        student_code: studentCode,
        sex,
        priority_group: priorityGroup === "none" ? null : priorityGroup,
      });
      await refreshProfile();
      toast("Datos guardados", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "No se pudo guardar", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="mt-4">
      <CardContent className="space-y-3 p-5">
        <div className="flex items-center gap-2 font-bold">
          <IdCard className="size-5 text-primary" />
          Datos institucionales
        </div>
        <p className="text-xs text-muted-foreground">
          Los pide Bienestar para los reportes de tutoría. Solo tú los ves.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="prof-id">Identificación</Label>
            <Input
              id="prof-id"
              value={nationalId}
              onChange={(e) => setNationalId(e.target.value)}
              placeholder="Cédula"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="prof-code">Código estudiantil</Label>
            <Input
              id="prof-code"
              value={studentCode}
              onChange={(e) => setStudentCode(e.target.value)}
              placeholder="Ej. 1242610001"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Sexo</Label>
          <div className="flex rounded-xl bg-muted/50 p-1">
            {(["F", "M"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSex(s)}
                className={cn(
                  "flex-1 rounded-lg py-1.5 text-sm font-semibold transition-colors",
                  sex === s ? "bg-card text-foreground shadow" : "text-muted-foreground",
                )}
              >
                {s === "F" ? "Femenino" : "Masculino"}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Grupo priorizado</Label>
          <Select
            value={priorityGroup}
            onValueChange={(v) => setPriorityGroup(v as PriorityGroup | "none")}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Ninguno</SelectItem>
              {PRIORITY_GROUPS.map((g) => (
                <SelectItem key={g.value} value={g.value}>
                  {g.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          variant="brand"
          className="w-full"
          onClick={save}
          disabled={saving}
        >
          {saving ? <Spinner className="size-4" /> : <Check className="size-4" />}
          Guardar
        </Button>
      </CardContent>
    </Card>
  );
}
