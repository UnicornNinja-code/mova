import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { dssService } from "@/services/dssService";
import { dssKeys } from "@/lib/queryKeys";

export function useDssRecommendations(params = {}, options = {}) {
  return useQuery({
    queryKey: dssKeys.recommendation(params.timeSlot, {
      latitude: params.latitude,
      longitude: params.longitude,
    }),
    queryFn: () => dssService.getRecommendations(params),
    ...options,
  });
}

export function useSpotRankings(zoneId, params = {}, options = {}) {
  return useQuery({
    queryKey: dssKeys.spotRankings(zoneId),
    queryFn: () => dssService.getSpotRankings(zoneId, params),
    enabled: Boolean(zoneId),
    ...options,
  });
}

export function useActiveWeights(options = {}) {
  return useQuery({
    queryKey: dssKeys.activeWeights(),
    queryFn: () => dssService.getActiveWeights(),
    ...options,
  });
}

export function useDssHistory(params = {}, options = {}) {
  return useQuery({
    queryKey: dssKeys.history(params),
    queryFn: () => dssService.getHistoricalSnapshots(params),
    ...options,
  });
}

export function useCalculateBwmMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (bwmInput) => dssService.calculateBwmWeights(bwmInput),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dssKeys.activeWeights() });
    },
  });
}

export function useSetActiveWeightsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (configId) => dssService.setActiveWeights(configId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dssKeys.activeWeights() });
    },
  });
}
