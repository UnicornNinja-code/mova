import { api } from "./api";

export const dssService = {
  // --- DSS Engine Group 4 ---
  async getRecommendations({ timeSlot, latitude, longitude, hubOrigin } = {}) {
    const response = await api.get("/api/dss/recommendations", {
      params: {
        time_slot: timeSlot,
        latitude,
        longitude,
        hub_origin: hubOrigin,
      },
    });
    return response.data?.data || response.data;
  },

  async getSpotRankings(zoneId, { timeSlot } = {}) {
    const response = await api.get(`/api/dss/spots/${zoneId}`, {
      params: { time_slot: timeSlot },
    });
    return response.data?.data || response.data;
  },

  async calculateBwmWeights(payload) {
    const response = await api.post("/api/dss/bwm/calculate", payload);
    return response.data?.data || response.data;
  },

  async getActiveWeights() {
    const response = await api.get("/api/dss/weights/active");
    return response.data?.data || response.data;
  },

  async setActiveWeights(configId) {
    const response = await api.post(`/api/dss/weights/${configId}/activate`);
    return response.data?.data || response.data;
  },

  async getCriteriaMatrix(zoneId, params = {}) {
    const response = await api.get(`/api/dss/criteria-matrix/${zoneId}`, { params });
    return response.data?.data || response.data;
  },

  // --- DSS Flashback Group 18 ---
  async getHistoricalSnapshots(params = {}) {
    const response = await api.get("/api/dss/history", { params });
    return response.data?.data || response.data;
  },

  async getSnapshotDetail(snapshotId) {
    const response = await api.get(`/api/dss/history/${snapshotId}`);
    return response.data?.data || response.data;
  },
};
