import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { zoneService } from "@/services/zoneService";
import { zoneKeys } from "@/lib/queryKeys";

export function useZonesList(params = {}, options = {}) {
  return useQuery({
    queryKey: zoneKeys.list(params),
    queryFn: () => zoneService.getZones(params),
    ...options,
  });
}

export function useZoneDetail(id, options = {}) {
  return useQuery({
    queryKey: zoneKeys.detail(id),
    queryFn: () => zoneService.getZoneById(id),
    enabled: Boolean(id),
    ...options,
  });
}

export function useCandidateSpots(zoneId, options = {}) {
  return useQuery({
    queryKey: zoneKeys.spatialCandidateSpots(zoneId),
    queryFn: () => zoneService.getCandidateSpots(zoneId),
    enabled: Boolean(zoneId),
    ...options,
  });
}

export function useCreateZoneMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (zoneData) => zoneService.createZone(zoneData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: zoneKeys.all });
    },
  });
}

export function useUpdateZoneMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => zoneService.updateZone(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: zoneKeys.all });
      queryClient.invalidateQueries({ queryKey: zoneKeys.detail(id) });
    },
  });
}

export function useDeleteZoneMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => zoneService.deleteZone(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: zoneKeys.all });
    },
  });
}
