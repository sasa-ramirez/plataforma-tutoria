import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchReports,
  createReport,
  deleteReport,
  type CreateReportInput,
} from "@/services/reports";
import type { PeriodicReport } from "@/types/database";

export function useReports(courseId: string) {
  return useQuery({
    queryKey: ["reports", courseId],
    queryFn: () => fetchReports(courseId),
    enabled: !!courseId,
  });
}

export function useCreateReport(courseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<CreateReportInput, "courseId">) =>
      createReport({ courseId, ...input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reports", courseId] });
    },
  });
}

export function useDeleteReport(courseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (report: PeriodicReport) => deleteReport(report),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reports", courseId] });
    },
  });
}
