import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Flame, Trophy, LogOut, Mail, GraduationCap, Clock } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { Spinner } from "@/components/common/Spinner";
import { fetchMyTeacherRequest, requestTeacherRole } from "@/services/admin";
import { initials } from "@/lib/utils";

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
      toast("Solicitud enviada ✅ Un admin la revisará.", "success");
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
    </div>
  );
}
