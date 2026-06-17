import { Outlet, NavLink, useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  BookOpen,
  Dumbbell,
  User,
  LogOut,
  GraduationCap,
  ShieldCheck,
  LineChart,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { cn, initials } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { NotificationBell } from "@/components/notifications/NotificationBell";

const NAV = [
  { to: "/app", label: "Inicio", icon: LayoutDashboard, end: true },
  { to: "/app/courses", label: "Cursos", icon: BookOpen, end: false },
  { to: "/app/practice", label: "Practicar", icon: Dumbbell, end: false },
  { to: "/app/profile", label: "Perfil", icon: User, end: false },
];

const ADMIN_NAV = {
  to: "/app/admin",
  label: "Admin",
  icon: ShieldCheck,
  end: false,
};

const COORD_NAV = {
  to: "/app/coordinacion",
  label: "Coordinación",
  icon: LineChart,
  end: false,
};

export function AppLayout() {
  const { profile, signOut, isAdmin, isCoordinator } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const NAV_ITEMS = [
    ...NAV,
    ...(isCoordinator || isAdmin ? [COORD_NAV] : []),
    ...(isAdmin ? [ADMIN_NAV] : []),
  ];

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <div className="min-h-screen md:flex">
      {/* Sidebar (desktop) */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r bg-card/50 p-4 md:flex">
        <div className="flex items-center gap-2 px-2 py-3">
          <div className="grid size-9 place-items-center rounded-xl gradient-brand text-white">
            <GraduationCap className="size-5" />
          </div>
          <span className="text-lg font-extrabold tracking-tight">
            Kódea
          </span>
        </div>

        <nav className="mt-4 flex flex-1 flex-col gap-1">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )
              }
            >
              <item.icon className="size-5" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto flex items-center gap-3 rounded-xl border p-3">
          <Avatar className="size-9">
            <AvatarImage src={profile?.avatar_url ?? undefined} />
            <AvatarFallback>{initials(profile?.full_name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">
              {profile?.full_name}
            </p>
            <p className="truncate text-xs capitalize text-muted-foreground">
              {isCoordinator
                ? "Coordinación"
                : profile?.role === "teacher"
                  ? "Profesor"
                  : "Estudiante"}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="size-9"
            onClick={handleSignOut}
            aria-label="Cerrar sesión"
          >
            <LogOut className="size-4" />
          </Button>
        </div>
      </aside>

      {/* Contenido */}
      <main className="flex-1 pb-24 md:pb-0">
        {/* Barra superior con la campanita */}
        <div className="sticky top-0 z-30 flex items-center justify-between glass px-4 py-2 md:justify-end md:px-8">
          <span className="font-extrabold tracking-tight md:hidden">Kódea</span>
          <NotificationBell />
        </div>
        <div className="mx-auto w-full max-w-5xl px-4 py-5 md:px-8 md:py-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Bottom nav (mobile) */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/90 backdrop-blur-lg md:hidden">
        <div
          className="mx-auto grid max-w-md"
          style={{
            gridTemplateColumns: `repeat(${NAV_ITEMS.length}, minmax(0, 1fr))`,
          }}
        >
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  "relative flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground",
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.span
                      layoutId="tab-indicator"
                      className="absolute -top-px h-0.5 w-8 rounded-full bg-primary"
                    />
                  )}
                  <item.icon className="size-5" />
                  {item.label}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
