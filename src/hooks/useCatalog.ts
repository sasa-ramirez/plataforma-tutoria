import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchFaculties,
  fetchCareers,
  fetchSubjects,
  createFaculty,
  createCareer,
  createSubject,
  deleteFaculty,
  deleteCareer,
  deleteSubject,
} from "@/services/catalog";

export const catalogKeys = {
  faculties: ["catalog", "faculties"] as const,
  careers: (facultyId: string) => ["catalog", "careers", facultyId] as const,
  subjects: (careerId: string) => ["catalog", "subjects", careerId] as const,
};

export function useFaculties() {
  return useQuery({ queryKey: catalogKeys.faculties, queryFn: fetchFaculties });
}

export function useCareers(facultyId: string) {
  return useQuery({
    queryKey: catalogKeys.careers(facultyId),
    queryFn: () => fetchCareers(facultyId),
    enabled: !!facultyId,
  });
}

export function useSubjects(careerId: string) {
  return useQuery({
    queryKey: catalogKeys.subjects(careerId),
    queryFn: () => fetchSubjects(careerId),
    enabled: !!careerId,
  });
}

export function useCreateFaculty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => createFaculty(name),
    onSuccess: () => qc.invalidateQueries({ queryKey: catalogKeys.faculties }),
  });
}

export function useCreateCareer(facultyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => createCareer(facultyId, name),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: catalogKeys.careers(facultyId) }),
  });
}

export function useCreateSubject(careerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => createSubject(careerId, name),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: catalogKeys.subjects(careerId) }),
  });
}

export function useDeleteFaculty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteFaculty(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: catalogKeys.faculties }),
  });
}

export function useDeleteCareer(facultyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteCareer(id),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: catalogKeys.careers(facultyId) }),
  });
}

export function useDeleteSubject(careerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteSubject(id),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: catalogKeys.subjects(careerId) }),
  });
}
