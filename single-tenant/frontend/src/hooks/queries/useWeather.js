import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { weatherService } from "@/services/weatherService";
import { weatherKeys } from "@/lib/queryKeys";

export function useHubWeather(cityName = "sidoarjo", options = {}) {
  return useQuery({
    queryKey: weatherKeys.hub(cityName),
    queryFn: () => weatherService.getHubWeather(cityName),
    refetchInterval: 60000, // Refresh every 60s
    ...options,
  });
}

export function useZoneWeatherTimeline(zoneId, params = {}, options = {}) {
  return useQuery({
    queryKey: weatherKeys.zoneTimeline(zoneId, params),
    queryFn: () => weatherService.getZoneWeatherTimeline(zoneId, params),
    enabled: Boolean(zoneId),
    ...options,
  });
}

export function useWeatherC4Scores(zoneId, options = {}) {
  return useQuery({
    queryKey: weatherKeys.c4Scores(zoneId),
    queryFn: () => weatherService.getWeatherC4Scores(zoneId),
    enabled: Boolean(zoneId),
    ...options,
  });
}

export function useWeatherSyncMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params) => weatherService.triggerWeatherSync(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: weatherKeys.all });
    },
  });
}
