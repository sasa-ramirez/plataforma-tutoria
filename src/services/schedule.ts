import { supabase } from "@/lib/supabase";

export interface ScheduleOption {
  id: string;
  label: string;
  votes: number;
  mine: boolean;
}

export async function fetchScheduleOptions(
  courseId: string,
): Promise<ScheduleOption[]> {
  const { data, error } = await supabase.rpc("schedule_options_with_votes", {
    p_course: courseId,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as ScheduleOption[];
}

export async function addScheduleOption(courseId: string, label: string) {
  const { error } = await supabase
    .from("schedule_options")
    .insert({ course_id: courseId, label: label.trim() });
  if (error) throw new Error(error.message);
}

export async function deleteScheduleOption(id: string) {
  const { error } = await supabase.from("schedule_options").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function voteOption(optionId: string, courseId: string) {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) throw new Error("No autenticado");
  const { error } = await supabase
    .from("schedule_votes")
    .insert({ option_id: optionId, course_id: courseId, student_id: uid });
  if (error) throw new Error(error.message);
}

export async function unvoteOption(optionId: string) {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) throw new Error("No autenticado");
  const { error } = await supabase
    .from("schedule_votes")
    .delete()
    .eq("option_id", optionId)
    .eq("student_id", uid);
  if (error) throw new Error(error.message);
}
