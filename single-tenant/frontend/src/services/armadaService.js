import { axiosInstance } from "../lib/axios.js";

/**
 * Armada / Fleet Domain Service (Canonical Backend Phase 1-7)
 */
export const armadaService = {
  getAll: async (params = {}) => {
    const res = await axiosInstance.get("/armadas", { params });
    return res.data;
  },

  getAvailable: async (params = {}) => {
    const res = await axiosInstance.get("/armadas", {
      params: { status: "AVAILABLE", ...params },
    });
    return res.data;
  },

  getById: async (id) => {
    const res = await axiosInstance.get(`/armadas/${id}`);
    return res.data;
  },

  create: async ({ code, name, type = "MOTOR_LISTRIK", status = "ACTIVE" }) => {
    const res = await axiosInstance.post("/armadas", { code, name, type, status });
    return res.data;
  },

  update: async (id, { code, name, type, status }) => {
    const res = await axiosInstance.put(`/armadas/${id}`, { code, name, type, status });
    return res.data;
  },

  delete: async (id) => {
    const res = await axiosInstance.delete(`/armadas/${id}`);
    return res.data;
  },

  holdArmada: async (id) => {
    const res = await axiosInstance.post(`/armadas/${id}/hold`);
    return res.data;
  },

  claimArmada: async (id) => {
    const res = await axiosInstance.post(`/armadas/${id}/claim`);
    return res.data;
  },

  releaseArmada: async (id) => {
    const res = await axiosInstance.post(`/armadas/${id}/release`);
    return res.data;
  },

  setMaintenance: async (id, payload = {}) => {
    const res = await axiosInstance.post(`/armadas/${id}/maintenance`, payload);
    return res.data;
  },

  releaseMaintenance: async (id) => {
    const res = await axiosInstance.post(`/armadas/${id}/release-maintenance`);
    return res.data;
  },

  // Aliases for backward compatibility
  getArmadas: async (params) => armadaService.getAll(params),
  getArmadaById: async (id) => armadaService.getById(id),
  createArmada: async (data) => armadaService.create(data),
  updateArmada: async (id, data) => armadaService.update(id, data),
  deleteArmada: async (id) => armadaService.delete(id),
};
