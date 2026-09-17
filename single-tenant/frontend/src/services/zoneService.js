import { axiosInstance } from "../lib/axios.js";

/**
 * Zone & Spatial Domain Service (Canonical Backend Phase 1-7)
 */
export const zoneService = {
  getAll: async (params = {}) => {
    const res = await axiosInstance.get("/zones", { params });
    return res.data;
  },

  getById: async (id) => {
    const res = await axiosInstance.get(`/zones/${id}`);
    return res.data;
  },

  getConfig: async () => {
    const res = await axiosInstance.get("/zones/config");
    return res.data;
  },

  validate: async ({ polygon, name, exclude_id }) => {
    const res = await axiosInstance.post("/zones/validate", { polygon, name, exclude_id });
    return res.data;
  },

  create: async ({ name, polygon, max_capacity = 5, status = "ACTIVE" }) => {
    const res = await axiosInstance.post("/zones", {
      name,
      polygon,
      max_capacity: Number(max_capacity),
      status,
    });
    return res.data;
  },

  update: async (id, data) => {
    const res = await axiosInstance.put(`/zones/${id}`, data);
    return res.data;
  },

  updateStatus: async (id, status) => {
    const res = await axiosInstance.patch(`/zones/${id}/status`, { status });
    return res.data;
  },

  updateCapacity: async (id, max_capacity) => {
    const res = await axiosInstance.patch(`/zones/${id}/capacity`, {
      max_capacity: Number(max_capacity),
    });
    return res.data;
  },

  delete: async (id) => {
    const res = await axiosInstance.delete(`/zones/${id}`);
    return res.data;
  },

  getSpatialRestrictions: async () => {
    const res = await axiosInstance.get("/system-settings/operational-rules");
    return res.data;
  },

  validatePolygon: async (payload) => {
    const res = await axiosInstance.post("/zones/validate", payload);
    return res.data;
  },

  // Aliases for backward compatibility
  getZones: async (params = {}) => zoneService.getAll(params),
  getZoneById: async (id) => zoneService.getById(id),
  createZone: async (data) => zoneService.create(data),
  updateZone: async (id, data) => zoneService.update(id, data),
  updateZoneStatus: async (id, status) => zoneService.updateStatus(id, status),
  updateZoneCapacity: async (id, max_capacity) => zoneService.updateCapacity(id, max_capacity),
  deleteZone: async (id) => zoneService.delete(id),
};
