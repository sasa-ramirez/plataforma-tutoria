import { supabase } from "@/lib/supabase";
import type { PriorityGroup } from "@/types/database";

export interface InstitutionalData {
  national_id: string;
  student_code: string;
  sex: "F" | "M" | "";
  priority_group: PriorityGroup | "" | null;
}

/** Datos institucionales que el propio estudiante llena en su Perfil
 * (cédula, código, sexo, grupo priorizado) — los piden los formatos de
 * Bienestar y antes no se guardaban en ningún lado. */
export async function updateInstitutionalData(
  data: InstitutionalData,
): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error("Sesión no válida.");
  const { error } = await supabase
    .from("profiles")
    .update({
      national_id: data.national_id.trim() || null,
      student_code: data.student_code.trim() || null,
      sex: data.sex || null,
      priority_group: data.priority_group || null,
    })
    .eq("id", uid);
  if (error) throw error;
}
