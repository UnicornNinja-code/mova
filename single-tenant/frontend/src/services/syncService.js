/*
 * syncService.js
 * Centralized Axios Service for Overpass OSM & Open-Meteo Weather Data Synchronization
 * Single-Tenant MOVA Architecture
 */

import { axiosInstance } from "../lib/axios.js";

export const syncService = {
  /**
   * Get overall data freshness status
   */
  async getStatus() {
    const res = await axiosInstance.get("/sync/status");
    return res.data?.data || res.data;
  },

  /**
   * Get recent sync execution audit runs
   */
  async getRuns() {
    const res = await axiosInstance.get("/sync/runs");
    return res.data?.data || res.data;
  },

  /**
   * Trigger on-demand POI sync from Overpass OSM
   */
  async triggerPoiSync(payload = {}) {
    const res = await axiosInstance.post("/sync/poi", payload);
    return res.data;
  },

  /**
   * Trigger on-demand Weather sync from Open-Meteo
   */
  async triggerWeatherSync(payload = {}) {
    const res = await axiosInstance.post("/sync/weather", payload);
    return res.data;
  },
};
