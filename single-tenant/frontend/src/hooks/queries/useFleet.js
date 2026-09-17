import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fleetService } from "@/services/fleetService";
import { fleetKeys } from "@/lib/queryKeys";

export function useFleetList(status, options = {}) {
  return useQuery({
    queryKey: fleetKeys.list(status),
    queryFn: () => fleetService.getFleetList({ status }),
    ...options,
  });
}

export function useFleetDetail(id, options = {}) {
  return useQuery({
    queryKey: fleetKeys.detail(id),
    queryFn: () => fleetService.getFleetById(id),
    enabled: Boolean(id),
    ...options,
  });
}

export function useCreateFleetMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => fleetService.createFleet(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: fleetKeys.all });
    },
  });
}

export function useUpdateFleetMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => fleetService.updateFleet(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: fleetKeys.all });
      queryClient.invalidateQueries({ queryKey: fleetKeys.detail(id) });
    },
  });
}

export function useUpdateFleetStatusMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, notes }) => fleetService.updateFleetStatus(id, status, notes),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: fleetKeys.all });
      queryClient.invalidateQueries({ queryKey: fleetKeys.detail(id) });
    },
  });
}
