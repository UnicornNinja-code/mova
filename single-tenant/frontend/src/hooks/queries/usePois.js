import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { poiService } from "@/services/poiService";
import { poiKeys } from "@/lib/queryKeys";

export function usePoisList(params = {}, options = {}) {
  return useQuery({
    queryKey: poiKeys.list(params),
    queryFn: () => poiService.getPois(params),
    ...options,
  });
}

export function usePoiDetail(id, options = {}) {
  return useQuery({
    queryKey: poiKeys.detail(id),
    queryFn: () => poiService.getPoiById(id),
    enabled: Boolean(id),
    ...options,
  });
}

export function usePoiQualitySummary(options = {}) {
  return useQuery({
    queryKey: poiKeys.qualitySummary(),
    queryFn: () => poiService.getQualitySummary(),
    ...options,
  });
}

export function usePendingPoiApprovals(options = {}) {
  return useQuery({
    queryKey: poiKeys.pendingApprovals(),
    queryFn: () => poiService.getPendingApprovals(),
    ...options,
  });
}

export function useC3CrowdScores(options = {}) {
  return useQuery({
    queryKey: poiKeys.c3CrowdScores(),
    queryFn: () => poiService.getC3CrowdScores(),
    ...options,
  });
}

export function useApprovePoiMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => poiService.approvePoi(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: poiKeys.all });
    },
  });
}

export function useRejectPoiMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }) => poiService.rejectPoi(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: poiKeys.all });
    },
  });
}

export function useTriggerOverpassSyncMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (syncParams) => poiService.triggerOverpassSync(syncParams),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: poiKeys.all });
    },
  });
}
