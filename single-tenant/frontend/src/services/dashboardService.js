import { axiosInstance } from "../lib/axios.js";

/**
 * Dashboard Domain Service (Canonical Backend Phase 5/7)
 * Serves aggregated, zero-divergence metrics for Executive & Operational dashboards.
 */
export const dashboardService = {
  getSummary: async (range = "today") => {
    const res = await axiosInstance.get("/dashboard/summary", { params: { range } });
    return res.data;
  },

  getSalesTrend: async (range = "7d") => {
    const res = await axiosInstance.get("/dashboard/sales-trend", { params: { range } });
    return res.data;
  },

  getZonePerformance: async (range = "30d") => {
    const res = await axiosInstance.get("/dashboard/zone-performance", { params: { range } });
    return res.data;
  },

  getOverview: async (params = {}) => {
    const res = await axiosInstance.get("/dashboard/overview", { params });
    return res.data;
  },

  getProductPerformance: async (range = "30d") => {
    const res = await axiosInstance.get("/dashboard/product-performance", { params: { range } });
    return res.data;
  },

  getQuickAlerts: async (params = {}) => {
    const res = await axiosInstance.get("/dashboard/quick-alerts", { params });
    return res.data;
  },
};
