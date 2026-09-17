import { axiosInstance } from "../lib/axios.js";

/**
 * Notification Service
 * Client for /api/notifications endpoint
 */
export const notificationService = {
  getNotifications: async () => {
    const res = await axiosInstance.get("/notifications");
    return res.data;
  },

  markAsRead: async (id) => {
    const res = await axiosInstance.patch(`/notifications/${id}/read`);
    return res.data;
  },

  markAllAsRead: async () => {
    const res = await axiosInstance.patch("/notifications/read-all");
    return res.data;
  },
};

export default notificationService;
