import { axiosInstance } from "../lib/axios.js";

export const dssService = {
  // 1. Evaluation & Execution
  evaluate: async (payload) => {
    const res = await axiosInstance.post("/dss/evaluate", payload);
    return res.data;
  },
  evaluateHybridBwmTopsis: async (payload) => {
    const res = await axiosInstance.post("/dss/evaluate", payload);
    return res.data;
  },
  getExplanation: async (runId) => {
    const res = await axiosInstance.get(`/dss/explanation/${runId}`);
    return res.data;
  },

  // 2. BWM Solver & Config Management
  getConfigs: async () => {
    const res = await axiosInstance.get("/dss/configs");
    return res.data;
  },
  getBwmConfigs: async () => {
    const res = await axiosInstance.get("/dss/configs");
    return res.data;
  },
  getActiveDssConfig: async () => {
    const res = await axiosInstance.get("/dss/bwm/active");
    return res.data;
  },
  calculateBwm: async (payload) => {
    const res = await axiosInstance.post("/dss/calculate-bwm", payload);
    return res.data;
  },
  calculateBwmWeights: async (payload) => {
    const res = await axiosInstance.post("/dss/calculate-bwm", payload);
    return res.data;
  },
  saveConfig: async (payload) => {
    const res = await axiosInstance.post("/dss/save-config", payload);
    return res.data;
  },
  activateConfig: async (id) => {
    const res = await axiosInstance.put(`/dss/configs/${id}/activate`);
    return res.data;
  },
  activateBwmConfig: async (id) => {
    const res = await axiosInstance.put(`/dss/configs/${id}/activate`);
    return res.data;
  },
  deleteConfig: async (id) => {
    const res = await axiosInstance.delete(`/dss/configs/${id}`);
    return res.data;
  },

  // 3. What-If Simulator
  previewImpact: async (payload) => {
    const res = await axiosInstance.post("/dss/preview-impact", payload);
    return res.data;
  },
  previewBwmImpact: async (payload) => {
    const res = await axiosInstance.post("/dss/preview-impact", payload);
    return res.data;
  },

  // 4. History & Records
  getHistory: async (params = {}) => {
    const res = await axiosInstance.get("/dss/history", { params });
    return res.data;
  },
  getDssHistory: async (params = {}) => {
    const res = await axiosInstance.get("/dss/history", { params });
    return res.data;
  },
  getHistoryById: async (id) => {
    const res = await axiosInstance.get(`/dss/history/${id}`);
    return res.data;
  },
  getDssHistoryById: async (id) => {
    const res = await axiosInstance.get(`/dss/history/${id}`);
    return res.data;
  },
  getHistoryByZone: async (zoneId) => {
    const res = await axiosInstance.get(`/dss/history/zone/${zoneId}`);
    return res.data;
  },

  // 5. Recommendations & Snapshots
  getTopsisRecommendations: async () => {
    const res = await axiosInstance.get("/dss/recommendations");
    return res.data;
  },
  getZoneRawEvaluation: async (zoneId, params = {}) => {
    const res = await axiosInstance.get(`/dss/zones/${zoneId}/raw-evaluation`, { params });
    return res.data;
  },
  getDssSnapshots: async (params = {}) => {
    const res = await axiosInstance.get("/dss/snapshots", { params });
    return res.data;
  },
  getDssSnapshotById: async (id) => {
    const res = await axiosInstance.get(`/dss/snapshots/${id}`);
    return res.data;
  },
};

export default dssService;
