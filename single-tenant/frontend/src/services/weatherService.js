import { axiosInstance } from "../lib/axios.js";

export const weatherService = {
  getCurrentWeather: async () => {
    const res = await axiosInstance.get("/weather/current");
    return res.data;
  },

  getZoneWeatherScore: async (zone_id) => {
    const res = await axiosInstance.get(`/weather/zone/${zone_id}/score`);
    return res.data;
  },

  getZoneWeatherInfo: async (zone_id, time) => {
    if (!zone_id) return null;
    const params = time ? { time } : {};
    const res = await axiosInstance.get(`/weather/zone/${zone_id}`, { params });
    return res.data;
  },

  getZoneWeatherTimeline: async (zone_id, { date = "today", slot = "all" } = {}) => {
    if (!zone_id) return null;
    const res = await axiosInstance.get(`/weather/zone/${zone_id}/timeline`, {
      params: { date, slot },
    });
    return res.data;
  },

  getHubWeatherInfo: async (city_name) => {
    if (!city_name) return null;
    const res = await axiosInstance.get(`/weather/hub/${city_name}`);
    return res.data;
  },

  getHubWeather: async (city_name) => {
    if (!city_name) return null;
    const res = await axiosInstance.get(`/weather/hub/${city_name}`);
    return res.data;
  },

  getZoneC4Score: async (zone_id, time) => {
    if (!zone_id) return null;
    const params = time ? { time } : {};
    const res = await axiosInstance.get(`/weather/zone/${zone_id}/c4`, { params });
    return res.data;
  },

  syncWeather: async () => {
    const res = await axiosInstance.post("/weather/sync");
    return res.data;
  },
};

export default weatherService;
