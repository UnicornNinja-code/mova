import { api } from "./api";

export const fleetService = {
  // --- Armada Fleet Group 9 ---
  async getArmadas(params = {}) {
    const response = await api.get("/api/armadas", { params });
    return response.data?.data || response.data;
  },

  async getArmadaById(id) {
    const response = await api.get(`/api/armadas/${id}`);
    return response.data?.data || response.data;
  },

  async createArmada(armadaData) {
    const response = await api.post("/api/armadas", armadaData);
    return response.data?.data || response.data;
  },

  async updateArmada(id, armadaData) {
    const response = await api.put(`/api/armadas/${id}`, armadaData);
    return response.data?.data || response.data;
  },

  async deleteArmada(id) {
    const response = await api.delete(`/api/armadas/${id}`);
    return response.data?.data || response.data;
  },

  async holdArmada(armadaId) {
    const response = await api.post(`/api/armadas/${armadaId}/hold`);
    return response.data?.data || response.data;
  },

  async releaseArmadaHold(armadaId) {
    const response = await api.post(`/api/armadas/${armadaId}/release-hold`);
    return response.data?.data || response.data;
  },
};
