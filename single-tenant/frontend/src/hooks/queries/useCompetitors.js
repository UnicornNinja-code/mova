import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { competitorService } from "@/services/competitorService";
import { competitorKeys } from "@/lib/queryKeys";

export function useCompetitorSummary(options = {}) {
  return useQuery({
    queryKey: competitorKeys.summary(),
    queryFn: () => competitorService.getSummary(),
    ...options,
  });
}

export function useCompetitorsByZone(zoneId, options = {}) {
  return useQuery({
    queryKey: competitorKeys.byZone(zoneId),
    queryFn: () => competitorService.getByZone(zoneId),
    enabled: Boolean(zoneId),
    ...options,
  });
}

export function useZoneC6Score(zoneId, options = {}) {
  return useQuery({
    queryKey: competitorKeys.c6Score(zoneId),
    queryFn: () => competitorService.getZoneC6Score(zoneId),
    enabled: Boolean(zoneId),
    ...options,
  });
}

export function useCreateCompetitorMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => competitorService.createCompetitor(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: competitorKeys.all });
      if (variables?.zone_id) {
        queryClient.invalidateQueries({ queryKey: competitorKeys.byZone(variables.zone_id) });
      }
    },
  });
}

export function useBulkCreateCompetitorsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (competitors) => competitorService.bulkCreate(competitors),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: competitorKeys.all });
    },
  });
}

export function useReconcileCompetitorMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, poiMasterId }) => competitorService.reconcile(id, poiMasterId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: competitorKeys.all });
    },
  });
}

export function useUnlinkCompetitorMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => competitorService.unlink(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: competitorKeys.all });
    },
  });
}

export function useDeleteCompetitorMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => competitorService.deleteCompetitor(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: competitorKeys.all });
    },
  });
}
