import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { riderService } from "@/services/riderService";
import { riderKeys, fleetKeys, dashboardKeys } from "@/lib/queryKeys";

export function useActiveDuty(options = {}) {
  return useQuery({
    queryKey: riderKeys.liveDuty("current"),
    queryFn: () => riderService.getActiveDuty(),
    ...options,
  });
}

export function useLiveLocations(options = {}) {
  return useQuery({
    queryKey: riderKeys.liveLocations(),
    queryFn: () => riderService.getLiveLocations(),
    ...options,
  });
}

export function useDutyHistory(params = {}, options = {}) {
  return useQuery({
    queryKey: riderKeys.dutyHistory("current", params),
    queryFn: () => riderService.getDutyHistory(params),
    ...options,
  });
}

export function useSessionDetails(sessionId, options = {}) {
  return useQuery({
    queryKey: riderKeys.dutyDetails(sessionId),
    queryFn: () => riderService.getSessionDetail(sessionId),
    enabled: Boolean(sessionId),
    ...options,
  });
}

export function useClaimArmadaMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ armadaId }) => riderService.claimArmada({ armadaId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: fleetKeys.all });
      queryClient.invalidateQueries({ queryKey: riderKeys.all });
    },
  });
}

export function useCheckInMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ latitude, longitude, zoneId }) =>
      riderService.checkInSpasial({ latitude, longitude, zoneId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: riderKeys.all });
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
    },
  });
}

export function useRecordSaleMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (saleData) => riderService.recordSale(saleData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: riderKeys.all });
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
    },
  });
}

export function useCheckoutMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (checkoutData) => riderService.checkoutShift(checkoutData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: riderKeys.all });
      queryClient.invalidateQueries({ queryKey: fleetKeys.all });
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
    },
  });
}

export function useSendGpsPingMutation() {
  return useMutation({
    mutationFn: (telemetryData) => riderService.sendGpsPing(telemetryData),
  });
}
