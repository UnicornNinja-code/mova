import { api } from "./api";

export const zoneService = {
  // --- Zone Master Group 3 ---
  async getZones(params = {}) {
    const response = await api.get("/api/zones", { params });
    return response.data?.data || response.data;
  },

  async getZoneById(id) {
    const response = await api.get(`/api/zones/${id}`);
    return response.data?.data || response.data;
  },

  async createZone(zoneData) {
    const response = await api.post("/api/zones", zoneData);
    return response.data?.data || response.data;
  },

  async updateZone(id, zoneData) {
    const response = await api.put(`/api/zones/${id}`, zoneData);
    return response.data?.data || response.data;
  },

  async deleteZone(id) {
    const response = await api.delete(`/api/zones/${id}`);
    return response.data?.data || response.data;
  },

  async checkOverlap(polygon) {
    const response = await api.post("/api/zones/check-overlap", { polygon });
    return response.data?.data || response.data;
  },

  // --- Candidate Locations Group 7 ---
  async getCandidateSpots(zoneId) {
    const response = await api.get(`/api/candidate-locations/zone/${zoneId}`);
    return response.data?.data || response.data;
  },

  async createCandidateSpot(spotData) {
    const response = await api.post("/api/candidate-locations", spotData);
    return response.data?.data || response.data;
  },

  async deleteCandidateSpot(id) {
    const response = await api.delete(`/api/candidate-locations/${id}`);
    return response.data?.data || response.data;
  },
};
