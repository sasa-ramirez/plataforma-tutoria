import { supabase } from "@/lib/supabase";
import type { TeacherRequest } from "@/types/database";

/** El usuario actual solicita ser profesor. */
export async function requestTeacherRole(note?: string): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error("Inicia sesión primero.");
  const { error } = await supabase
    .from("teacher_requests")
    .insert({ user_id: uid, note: note ?? null });
  if (error) {
    if (error.code === "23505")
      throw new Error("Ya tienes una solicitud pendiente.");
    throw error;
  }
}

/** Última solicitud del usuario actual (para mostrar su estado). */
export async function fetchMyTeacherRequest(): Promise<TeacherRequest | null> {
  const { data, error } = await supabase
    .from("teacher_requests")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as TeacherRequest) ?? null;
}

export interface PendingRequest extends TeacherRequest {
  full_name: string | null;
  email: string;
}

/** Solicitudes pendientes (solo admin las ve por RLS). */
export async function fetchPendingTeacherRequests(): Promise<PendingRequest[]> {
  const { data, error } = await supabase
    .from("teacher_requests")
    .select("*, profiles!teacher_requests_user_id_fkey(full_name, email)")
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => {
    const row = r as unknown as TeacherRequest & {
      profiles: { full_name: string | null; email: string } | null;
    };
    return {
      ...row,
      full_name: row.profiles?.full_name ?? null,
      email: row.profiles?.email ?? "",
    };
  });
}

/** Aprueba o rechaza (vía RPC SECURITY DEFINER que valida admin). */
export async function reviewTeacherRequest(reqId: string, approve: boolean) {
  const { error } = await supabase.rpc("review_teacher_request", {
    req_id: reqId,
    approve,
  });
  if (error) throw error;
}
