import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { weatherService } from "@/services/weatherService";
import { weatherKeys } from "@/lib/queryKeys";

export function useHubWeather(cityName = "sidoarjo", params = {}, options = {}) {
  return useQuery({
    queryKey: weatherKeys.hub(cityName, params),
    queryFn: () => weatherService.getHubWeather(cityName, params),
    refetchInterval: 60000, // Refresh every 60s
    ...options,
  });
}

export function useZoneWeatherTimeline(zoneId, params = {}, options = {}) {
  return useQuery({
    queryKey: weatherKeys.zoneTimeline(zoneId, params),
    queryFn: () => weatherService.getZoneWeatherTimeline(zoneId, params),
    enabled: Boolean(zoneId && zoneId !== "all" && zoneId !== "zone-all"),
    ...options,
  });
}

export function useWeatherC4Scores(zoneId, params = {}, options = {}) {
  return useQuery({
    queryKey: weatherKeys.c4Scores(zoneId, params),
    queryFn: () => weatherService.getWeatherC4Scores(zoneId, params),
    enabled: Boolean(zoneId && zoneId !== "all" && zoneId !== "zone-default"),
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
