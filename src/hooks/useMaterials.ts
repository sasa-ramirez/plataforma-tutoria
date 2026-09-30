import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchMaterials,
  addMaterialFile,
  addMaterialLink,
  deleteMaterial,
  type CourseMaterial,
} from "@/services/materials";

export function useMaterials(courseId: string) {
  return useQuery({
    queryKey: ["materials", courseId],
    queryFn: () => fetchMaterials(courseId),
    enabled: !!courseId,
  });
}

export function useAddMaterialFile(courseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: addMaterialFile,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["materials", courseId] }),
  });
}

export function useAddMaterialLink(courseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: addMaterialLink,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["materials", courseId] }),
  });
}

export function useDeleteMaterial(courseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (material: CourseMaterial) => deleteMaterial(material),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["materials", courseId] }),
  });
}
