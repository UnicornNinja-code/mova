import { axiosInstance } from "../lib/axios.js";

/**
 * Competitor Intelligence & Spatial Survey Domain Service (Canonical Backend Phase 2/7)
 */
export const competitorService = {
  getCompetitorsByZone: async (zone_id) => {
    if (!zone_id) return { competitors: [], count: 0 };
    const res = await axiosInstance.get(`/competitors/zone/${zone_id}`);
    return res.data;
  },

  getC6Score: async (zone_id) => {
    if (!zone_id) return { skor_c6: 0 };
    const res = await axiosInstance.get(`/competitors/score/${zone_id}`);
    return res.data;
  },

  createCompetitor: async (data) => {
    const res = await axiosInstance.post("/competitors", data);
    return res.data;
  },

  deleteCompetitor: async (id) => {
    const res = await axiosInstance.delete(`/competitors/${id}`);
    return res.data;
  },

  getCompetitorSummary: async () => {
    const res = await axiosInstance.get("/competitors/summary");
    return res.data;
  },

  getProtocolRoads: async () => {
    const res = await axiosInstance.get("/roads/protocol");
    return res.data;
  },
};

