import { axiosInstance } from "../lib/axios.js";

/**
 * Sales Ledger & Reporting Service (Canonical Backend Phase 4/7)
 */
export const salesService = {
  getOverview: async (params = {}) => {
    const res = await axiosInstance.get("/sales/overview", { params });
    return res.data;
  },

  getMySales: async (params = {}) => {
    const res = await axiosInstance.get("/sales/my-sales", { params });
    return res.data;
  },

  getHistory: async (params = {}) => {
    return salesService.getMySales(params);
  },

  getByZone: async (zoneId, params = {}) => {
    const res = await axiosInstance.get("/sales/overview", {
      params: { zone_id: zoneId, ...params },
    });
    return res.data;
  },

  getByRider: async (riderId, params = {}) => {
    const res = await axiosInstance.get("/sales/overview", {
      params: { rider_id: riderId, ...params },
    });
    return res.data;
  },
};
