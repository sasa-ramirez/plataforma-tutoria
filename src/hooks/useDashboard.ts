import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { fetchStudentStats, fetchTeacherStats } from "@/services/dashboard";

export function useStudentStats() {
  const { profile } = useAuth();
  return useQuery({
    queryKey: ["dashboard", "student", profile?.id],
    queryFn: () => fetchStudentStats(profile!.id),
    enabled: !!profile,
  });
}

export function useTeacherStats() {
  const { profile } = useAuth();
  return useQuery({
    queryKey: ["dashboard", "teacher", profile?.id],
    queryFn: () => fetchTeacherStats(profile!.id),
    enabled: !!profile,
  });
}
