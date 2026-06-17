import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchScheduleOptions,
  addScheduleOption,
  deleteScheduleOption,
  voteOption,
  unvoteOption,
} from "@/services/schedule";

export function useScheduleOptions(courseId: string) {
  return useQuery({
    queryKey: ["schedule", courseId],
    queryFn: () => fetchScheduleOptions(courseId),
    enabled: !!courseId,
  });
}

export function useScheduleMutations(courseId: string) {
  const qc = useQueryClient();
  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["schedule", courseId] });

  const add = useMutation({
    mutationFn: (label: string) => addScheduleOption(courseId, label),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteScheduleOption(id),
    onSuccess: invalidate,
  });
  const vote = useMutation({
    mutationFn: (optionId: string) => voteOption(optionId, courseId),
    onSuccess: invalidate,
  });
  const unvote = useMutation({
    mutationFn: (optionId: string) => unvoteOption(optionId),
    onSuccess: invalidate,
  });

  return { add, remove, vote, unvote };
}
