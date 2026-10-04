import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchStudySpaces,
  fetchStudySpace,
  createStudySpace,
  deleteStudySpace,
  fetchStudyDocuments,
  deleteStudyDocument,
  fetchStudyNotes,
  processStudyDocument,
  type ProcessProgress,
  type StudySpace,
} from "@/services/study";

export function useStudySpaces() {
  return useQuery({ queryKey: ["study", "spaces"], queryFn: fetchStudySpaces });
}

export function useStudySpace(id: string) {
  return useQuery({
    queryKey: ["study", "space", id],
    queryFn: () => fetchStudySpace(id),
    enabled: !!id,
  });
}

export function useCreateStudySpace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (title: string) => createStudySpace(title),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["study", "spaces"] }),
  });
}

export function useDeleteStudySpace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteStudySpace(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["study"] }),
  });
}

export function useStudyDocuments(spaceId: string) {
  return useQuery({
    queryKey: ["study", "documents", spaceId],
    queryFn: () => fetchStudyDocuments(spaceId),
    enabled: !!spaceId,
  });
}

export function useStudyNotes(spaceId: string) {
  return useQuery({
    queryKey: ["study", "notes", spaceId],
    queryFn: () => fetchStudyNotes(spaceId),
    enabled: !!spaceId,
  });
}

export function useDeleteStudyDocument(spaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteStudyDocument(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["study", "documents", spaceId] });
      qc.invalidateQueries({ queryKey: ["study", "notes", spaceId] });
      qc.invalidateQueries({ queryKey: ["study", "spaces"] });
    },
  });
}

export function useProcessStudyDocument(space: StudySpace | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ file, onProgress }: { file: File; onProgress?: (p: ProcessProgress) => void }) => {
      if (!space) throw new Error("Materia no cargada");
      return processStudyDocument({ space, file, onProgress });
    },
    // Aunque falle a medio camino, el documento (y notas parciales) ya quedaron guardados.
    onSettled: () => {
      if (!space) return;
      qc.invalidateQueries({ queryKey: ["study", "documents", space.id] });
      qc.invalidateQueries({ queryKey: ["study", "notes", space.id] });
      qc.invalidateQueries({ queryKey: ["study", "spaces"] });
    },
  });
}
