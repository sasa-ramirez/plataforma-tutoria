import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { fetchNotifications } from "@/services/notifications";
import { showBrowserNotification, playPing } from "@/lib/notify";

export function useNotifications() {
  const { profile } = useAuth();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["notifications"],
    queryFn: fetchNotifications,
    enabled: !!profile,
  });

  // Realtime: nuevas notificaciones aparecen al instante (sin recargar) y,
  // si el usuario dio permiso, también como aviso del sistema + pitido.
  useEffect(() => {
    if (!profile) return;
    const channel = supabase
      .channel(`notif:${profile.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${profile.id}`,
        },
        (payload) => {
          qc.invalidateQueries({ queryKey: ["notifications"] });
          const n = payload.new as {
            title?: string;
            body?: string | null;
            link?: string | null;
          };
          if (n?.title) {
            showBrowserNotification(n.title, n.body, n.link);
            playPing();
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile, qc]);

  return query;
}
