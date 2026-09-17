import { api } from "./api";

export const poiService = {
  // --- POI & Spatial Group 5 ---
  async getPois(params = {}) {
    const response = await api.get("/api/pois", { params });
    return response.data?.data || response.data;
  },

  async getPoisByZone(zoneId) {
    const response = await api.get(`/api/pois/zone/${zoneId}`);
    return response.data?.data || response.data;
  },

  async syncOverpassPois(hubCity = "Sidoarjo") {
    const response = await api.post("/api/pois/sync-overpass", { hubCity });
    return response.data?.data || response.data;
  },

  async reclusterPois() {
    const response = await api.post("/api/pois/recluster");
    return response.data?.data || response.data;
  },

  async getQualitySummary() {
    const response = await api.get("/api/pois/quality-summary");
    return response.data?.data || response.data;
  },

  async getPendingApprovals() {
    const response = await api.get("/api/pois/pending-approvals");
    return response.data?.data || response.data;
  },

  async approveOrRejectPoi(id, { status, notes }) {
    const response = await api.post(`/api/pois/${id}/approval`, { status, notes });
    return response.data?.data || response.data;
  },

  // --- POI & C3 Criteria Group 17 ---
  async getCategoryTimeScores() {
    const response = await api.get("/api/pois/categories/time-scores");
    return response.data?.data || response.data;
  },

  async updateCategoryTimeScores(categoryId, scores) {
    const response = await api.put(`/api/pois/categories/${categoryId}/time-scores`, scores);
    return response.data?.data || response.data;
  },
};
