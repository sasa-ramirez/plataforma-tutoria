import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchActas, createActa, deleteActa, type CreateActaInput } from "@/services/actas";

export function useActas(courseId: string) {
  return useQuery({
    queryKey: ["actas", courseId],
    queryFn: () => fetchActas(courseId),
    enabled: !!courseId,
  });
}

export function useCreateActa(courseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<CreateActaInput, "courseId">) =>
      createActa({ courseId, ...input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["actas", courseId] });
    },
  });
}

export function useDeleteActa(courseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteActa(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["actas", courseId] });
    },
  });
}
