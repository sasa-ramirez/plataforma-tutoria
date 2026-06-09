import { supabase } from "@/lib/supabase";
import type { Career, Faculty, Subject } from "@/types/database";

// ---- Lecturas (cualquier autenticado) ----
export async function fetchFaculties(): Promise<Faculty[]> {
  const { data, error } = await supabase
    .from("faculties")
    .select("*")
    .order("name");
  if (error) throw error;
  return (data ?? []) as Faculty[];
}

export async function fetchCareers(facultyId: string): Promise<Career[]> {
  const { data, error } = await supabase
    .from("careers")
    .select("*")
    .eq("faculty_id", facultyId)
    .order("name");
  if (error) throw error;
  return (data ?? []) as Career[];
}

export async function fetchSubjects(careerId: string): Promise<Subject[]> {
  const { data, error } = await supabase
    .from("subjects")
    .select("*")
    .eq("career_id", careerId)
    .order("name");
  if (error) throw error;
  return (data ?? []) as Subject[];
}

// ---- Escrituras (solo admin, validado por RLS) ----
export async function createFaculty(name: string): Promise<Faculty> {
  const { data, error } = await supabase
    .from("faculties")
    .insert({ name: name.trim() })
    .select()
    .single();
  if (error) throw error;
  return data as Faculty;
}

export async function createCareer(
  facultyId: string,
  name: string,
): Promise<Career> {
  const { data, error } = await supabase
    .from("careers")
    .insert({ faculty_id: facultyId, name: name.trim() })
    .select()
    .single();
  if (error) throw error;
  return data as Career;
}

export async function createSubject(
  careerId: string,
  name: string,
): Promise<Subject> {
  const { data, error } = await supabase
    .from("subjects")
    .insert({ career_id: careerId, name: name.trim() })
    .select()
    .single();
  if (error) throw error;
  return data as Subject;
}

export async function deleteFaculty(id: string): Promise<void> {
  const { error } = await supabase.from("faculties").delete().eq("id", id);
  if (error) throw error;
}
export async function deleteCareer(id: string): Promise<void> {
  const { error } = await supabase.from("careers").delete().eq("id", id);
  if (error) throw error;
}
export async function deleteSubject(id: string): Promise<void> {
  const { error } = await supabase.from("subjects").delete().eq("id", id);
  if (error) throw error;
}
