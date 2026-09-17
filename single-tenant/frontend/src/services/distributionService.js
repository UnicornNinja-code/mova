import { axiosInstance } from "../lib/axios.js";

export const distributionService = {
  confirmDuty: async (payload = {}) => {
    const res = await axiosInstance.post("/distribution/duty/confirm", payload);
    return res.data;
  },
  confirmDutyBackwardCompat: async (payload = {}) => {
    const res = await axiosInstance.post("/distribution/duty-confirm", payload);
    return res.data;
  },
  getStatus: async () => {
    const res = await axiosInstance.get("/distribution/status");
    return res.data;
  },
  getQueue: async (params = {}) => {
    const res = await axiosInstance.get("/distribution/queue", { params });
    return res.data;
  },
  getDutyStatus: async (riderId) => {
    const params = riderId ? { rider_id: riderId } : {};
    const res = await axiosInstance.get("/distribution/duty/status", { params });
    return res.data;
  },
  getOverview: async (timeSlot) => {
    const params = timeSlot && timeSlot !== "realtime" ? { time: timeSlot } : {};
    const res = await axiosInstance.get("/distribution/overview", { params });
    return res.data;
  },
  autoDistribute: async ({ time } = {}) => {
    const payload = time && time !== "realtime" ? { time } : {};
    const res = await axiosInstance.post("/distribution/auto-assign", payload);
    return res.data;
  },
  manualDistribute: async ({ rider_id, zone_id, time, reason } = {}) => {
    const res = await axiosInstance.post("/distribution/manual-assign", {
      rider_id,
      zone_id,
      time: time && time !== "realtime" ? time : undefined,
      reason,
    });
    return res.data;
  },
  overrideDistribute: async ({ rider_id, zone_id, reason, time } = {}) => {
    const res = await axiosInstance.post("/distribution/override", {
      rider_id,
      zone_id,
      reason,
      time: time && time !== "realtime" ? time : undefined,
    });
    return res.data;
  },
  getRuns: async (limit = 20) => {
    const res = await axiosInstance.get("/distribution/runs", { params: { limit } });
    return res.data;
  },
  getRunById: async (id) => {
    const res = await axiosInstance.get(`/distribution/runs/${id}`);
    return res.data;
  },
  getMyDutyHistory: async (limit = 30) => {
    const res = await axiosInstance.get("/distribution/my-history", { params: { limit } });
    return res.data;
  },
  getRidersSummary: async () => {
    const res = await axiosInstance.get("/distribution/riders/summary");
    return res.data;
  },
};

export default distributionService;
