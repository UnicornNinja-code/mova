import { axiosInstance } from "../lib/axios.js";

/**
 * User Account Domain Service (Canonical Backend Phase 1-7)
 */
export const userService = {
  getAll: async (params = {}) => {
    const res = await axiosInstance.get("/users", { params });
    return res.data;
  },

  getById: async (id) => {
    const res = await axiosInstance.get(`/users/${id}`);
    return res.data;
  },

  create: async (data) => {
    const res = await axiosInstance.post("/users", data);
    return res.data;
  },

  update: async (id, data) => {
    const res = await axiosInstance.put(`/users/${id}`, data);
    return res.data;
  },

  updateStatus: async (id, is_active) => {
    const res = await axiosInstance.patch(`/users/${id}/status`, { is_active });
    return res.data;
  },

  delete: async (id) => {
    const res = await axiosInstance.delete(`/users/${id}`);
    return res.data;
  },

  getProfile: async () => {
    const res = await axiosInstance.get("/users/profile");
    return res.data;
  },

  updateProfile: async (data) => {
    const res = await axiosInstance.put("/users/profile", data);
    return res.data;
  },

  changePassword: async (data) => {
    const res = await axiosInstance.put("/users/change-password", data);
    return res.data;
  },

  // Aliases for backward compatibility
  getUsers: async (params = {}) => userService.getAll(params),
  getUserById: async (id) => userService.getById(id),
  createUser: async (data) => userService.create(data),
  updateUser: async (id, data) => userService.update(id, data),
  setUserStatus: async (id, is_active) => userService.updateStatus(id, is_active),
  deleteUser: async (id) => userService.delete(id),
};
