import { axiosInstance } from "../lib/axios.js";

export const auditService = {
  getAuditLogs: async (params = {}) => {
    const res = await axiosInstance.get("/audit-logs", { params });
    return res.data;
  },
  getById: async (id) => {
    const res = await axiosInstance.get(`/audit-logs/${id}`);
    return res.data;
  },
};
