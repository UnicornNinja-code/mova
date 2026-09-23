import { api } from "./api";

export const roadService = {
  // --- Protocol Roads ---
  async getProtocolRoads(params = {}) {
    const response = await api.get("/api/roads/protocol", { params });
    return response.data?.data || response.data;
  },

  async syncProtocolRoads(hubCity = "Sidoarjo") {
    // 180s timeout prevents false negative abort during Overpass retry/backoff
    const response = await api.post(
      "/api/roads/sync-protocol",
      { hubCity },
      { timeout: 180000 }
    );
    return response.data?.data || response.data;
  },

  // --- Toll Roads ---
  async getTollRoads(params = {}) {
    const response = await api.get("/api/roads/toll", { params });
    return response.data?.data || response.data;
  },

  async syncTollRoads(hubCity = "Sidoarjo", customBbox = null) {
    // 180s timeout prevents false negative abort during Overpass retry/backoff
    const response = await api.post(
      "/api/roads/sync-toll",
      { hubCity, customBbox },
      { timeout: 180000 }
    );
    return response.data?.data || response.data;
  },

  // --- Weather Suitability C4 ---
  async getZoneWeather(zoneId, { timeSlot } = {}) {
    const response = await api.get(`/api/weather/zone/${zoneId}`, {
      params: { time_slot: timeSlot },
    });
    return response.data?.data || response.data;
  },

  async getHubWeatherOverview(cityName = "Sidoarjo") {
    const response = await api.get("/api/weather/overview", {
      params: { city: cityName },
    });
    return response.data?.data || response.data;
  },
};
