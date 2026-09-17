import { axiosInstance } from "../lib/axios.js";

export const poiService = {
  getPois: async (params = {}) => {
    const res = await axiosInstance.get("/pois", { params });
    return res.data;
  },
  createPoi: async (payload) => {
    const res = await axiosInstance.post("/pois", payload);
    return res.data;
  },
  getUnapprovedPois: async (params = {}) => {
    const res = await axiosInstance.get("/pois/unapproved", { params });
    return res.data;
  },
  approvePoi: async (id, payload = {}) => {
    const res = await axiosInstance.patch(`/pois/${id}/approve`, payload);
    return res.data;
  },
  rejectPoi: async (id, payload = {}) => {
    const res = await axiosInstance.patch(`/pois/${id}/reject`, payload);
    return res.data;
  },
  getPoiCategories: async () => {
    const res = await axiosInstance.get("/pois/categories");
    return res.data;
  },
  getPoiDensityScore: async (zone_id) => {
    const res = await axiosInstance.get(`/pois/density/${zone_id}`);
    return res.data;
  },
  getPoiEventScore: async (zone_id) => {
    const res = await axiosInstance.get(`/pois/events/${zone_id}`);
    return res.data;
  },
  syncCityPois: async (payload = {}) => {
    const res = await axiosInstance.post("/pois/sync-city", payload);
    return res.data;
  },
  getPendingPois: async () => {
    const res = await axiosInstance.get("/pois/pending");
    return res.data;
  },
  approveOrRejectPoi: async (payload) => {
    const res = await axiosInstance.post("/pois/approve", payload);
    return res.data;
  },
  getApprovalLogs: async () => {
    const res = await axiosInstance.get("/pois/approval-logs");
    return res.data;
  },
  getOperationalAreaPois: async () => {
    const res = await axiosInstance.get("/pois/operational-area");
    return res.data;
  },
  getPoisByZone: async (zone_id) => {
    if (!zone_id) return { pois: [] };
    const res = await axiosInstance.get(`/pois/zone/${zone_id}`);
    return res.data;
  },
  getC1C2Scores: async (zone_id) => {
    if (!zone_id) return null;
    const res = await axiosInstance.get(`/pois/scores/c1-c2/${zone_id}`);
    return res.data;
  },
  getCrowdScores: async () => {
    const res = await axiosInstance.get("/poi-categories/crowd-scores");
    return res.data;
  },
  updateBulkCrowdScores: async (payload) => {
    const res = await axiosInstance.put("/poi-categories/crowd-scores", payload);
    return res.data;
  },
  updateSingleCrowdScores: async (id, payload) => {
    const res = await axiosInstance.put(`/poi-categories/${id}/crowd-scores`, payload);
    return res.data;
  },
  getPoiStats: async () => {
    const res = await axiosInstance.get("/pois/stats");
    return res.data;
  },
  getQualitySummary: async () => {
    const res = await axiosInstance.get("/pois/quality-summary");
    return res.data;
  },
};

