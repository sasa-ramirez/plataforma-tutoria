import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { FullScreenLoader } from "@/components/common/Spinner";
import type { UserRole } from "@/types/database";

export function ProtectedRoute({
  children,
  role,
  adminOnly = false,
  coordinatorOnly = false,
}: {
  children: React.ReactNode;
  role?: UserRole;
  adminOnly?: boolean;
  coordinatorOnly?: boolean;
}) {
  const { session, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) return <FullScreenLoader label="Cargando tu sesión…" />;

  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Espera a que el perfil cargue para conocer el rol
  if (!profile) return <FullScreenLoader />;

  if (role && profile.role !== role) {
    return <Navigate to="/app" replace />;
  }

  if (adminOnly && !profile.is_admin) {
    return <Navigate to="/app" replace />;
  }

  // Coordinación: la ve el coordinador o el admin.
  if (coordinatorOnly && !profile.is_coordinator && !profile.is_admin) {
    return <Navigate to="/app" replace />;
  }

  return <>{children}</>;
}
