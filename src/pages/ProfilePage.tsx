import { useNavigate } from "react-router-dom";
import { Flame, Trophy, LogOut, Mail } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { initials } from "@/lib/utils";

export function ProfilePage() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

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
    </div>
  );
}
