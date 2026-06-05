import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, CheckCheck } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useNotifications } from "@/hooks/useNotifications";
import { markAllRead, markRead } from "@/services/notifications";
import { ensureNotifyPermission } from "@/lib/notify";
import { enablePush } from "@/lib/push";
import { cn } from "@/lib/utils";

const TYPE_EMOJI: Record<string, string> = {
  graded: "✅",
  assignment: "📝",
  teacher_approved: "🎉",
  live: "🔴",
};

export function NotificationBell() {
  const { data } = useNotifications();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const items = data ?? [];
  const unread = items.filter((n) => !n.read).length;

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    // Al abrir, aprovechamos el gesto para pedir permiso y suscribir push.
    if (next) {
      ensureNotifyPermission().then((ok) => {
        if (ok) enablePush();
      });
    }
    if (next && unread > 0) {
      await markAllRead();
      qc.invalidateQueries({ queryKey: ["notifications"] });
    }
  };

  const openItem = async (id: string, link: string | null) => {
    await markRead(id);
    qc.invalidateQueries({ queryKey: ["notifications"] });
    setOpen(false);
    if (link) navigate(link);
  };

  return (
    <div className="relative">
      <button
        onClick={toggle}
        className="relative grid size-10 place-items-center rounded-xl hover:bg-muted"
        aria-label="Notificaciones"
      >
        <Bell className="size-5" />
        {unread > 0 && (
          <span className="absolute right-1 top-1 grid min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              className="absolute right-0 z-50 mt-2 max-h-[70vh] w-80 overflow-y-auto rounded-2xl border bg-popover p-2 shadow-2xl surface-glow"
            >
              <div className="flex items-center justify-between px-2 py-1.5">
                <span className="text-sm font-bold">Notificaciones</span>
                <CheckCheck className="size-4 text-muted-foreground" />
              </div>
              {items.length === 0 ? (
                <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                  No tienes notificaciones aún.
                </p>
              ) : (
                items.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => openItem(n.id, n.link)}
                    className={cn(
                      "flex w-full items-start gap-2 rounded-xl px-2 py-2 text-left transition-colors hover:bg-muted",
                      !n.read && "bg-primary/5",
                    )}
                  >
                    <span className="text-lg">{TYPE_EMOJI[n.type] ?? "🔔"}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">
                        {n.title}
                      </span>
                      {n.body && (
                        <span className="block text-xs text-muted-foreground">
                          {n.body}
                        </span>
                      )}
                      <span className="text-[10px] text-muted-foreground/60">
                        {new Date(n.created_at).toLocaleString()}
                      </span>
                    </span>
                    {!n.read && (
                      <span className="mt-1 size-2 shrink-0 rounded-full bg-primary" />
                    )}
                  </button>
                ))
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
