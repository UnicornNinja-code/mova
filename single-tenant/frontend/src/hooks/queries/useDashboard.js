import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { dashboardService } from "@/services/dashboardService";
import { dashboardKeys } from "@/lib/queryKeys";

export function useAnalyticsOverview(params = {}, options = {}) {
  return useQuery({
    queryKey: [...dashboardKeys.all, "analytics-overview", params],
    queryFn: () => dashboardService.getAnalyticsOverview(params),
    ...options,
  });
}

export function useOperationalSummary(params = {}, options = {}) {
  return useQuery({
    queryKey: [...dashboardKeys.all, "operational-summary", params],
    queryFn: () => dashboardService.getOperationalSummary(params),
    ...options,
  });
}

export function useFleetUtilization(params = {}, options = {}) {
  return useQuery({
    queryKey: dashboardKeys.fleetUtilization(),
    queryFn: () => dashboardService.getFleetUtilization(params),
    ...options,
  });
}

export function useComplianceSummary(params = {}, options = {}) {
  return useQuery({
    queryKey: [...dashboardKeys.all, "compliance-summary", params],
    queryFn: () => dashboardService.getComplianceSummary(params),
    ...options,
  });
}

export function useSalesPerformance(params = {}, options = {}) {
  return useQuery({
    queryKey: [...dashboardKeys.all, "sales-performance", params],
    queryFn: () => dashboardService.getSalesPerformance(params),
    ...options,
  });
}

export function useDssPlanVsActual(params = {}, options = {}) {
  return useQuery({
    queryKey: [...dashboardKeys.all, "plan-vs-actual", params],
    queryFn: () => dashboardService.getDssPlanVsActual(params),
    ...options,
  });
}

export function useQuickAlerts(options = {}) {
  return useQuery({
    queryKey: [...dashboardKeys.all, "quick-alerts"],
    queryFn: () => dashboardService.getQuickAlerts(),
    refetchInterval: 30000, // Background poll every 30s as fallback to sockets
    ...options,
  });
}

export function useExecutiveSummaryReport(params = {}, options = {}) {
  return useQuery({
    queryKey: dashboardKeys.executive(params.date),
    queryFn: () => dashboardService.getExecutiveSummaryReport(params),
    ...options,
  });
}

export function useAuditLogs(params = {}, options = {}) {
  return useQuery({
    queryKey: dashboardKeys.auditLogs(params),
    queryFn: () => dashboardService.getAuditLogs(params),
    ...options,
  });
}

export function useSystemSettings(options = {}) {
  return useQuery({
    queryKey: dashboardKeys.systemSettings(),
    queryFn: () => dashboardService.getSystemSettings(),
    ...options,
  });
}

export function useUpdateSystemSettingsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (settingsData) => dashboardService.updateSystemSettings(settingsData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dashboardKeys.systemSettings() });
    },
  });
}

export function useDataFreshness(options = {}) {
  return useQuery({
    queryKey: [...dashboardKeys.all, "freshness-summary"],
    queryFn: () => dashboardService.getDataFreshnessSummary(),
    ...options,
  });
}

export function useTriggerFreshnessSyncMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (moduleName) => dashboardService.triggerFreshnessSync(moduleName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...dashboardKeys.all, "freshness-summary"] });
    },
  });
}
