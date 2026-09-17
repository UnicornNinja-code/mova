/*
 * notificationService.ts
 * REST Client for User Notifications in TypeScript
 */

import { axiosInstance } from '../lib/axios';

export interface NotificationItem {
  id: string;
  user_id: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  updated_at?: string;
}

export interface NotificationResponse {
  status: string;
  count: number;
  unread_count: number;
  notifications: NotificationItem[];
}

export const notificationService = {
  getNotifications: async (limit: number = 30): Promise<NotificationResponse> => {
    const res = await axiosInstance.get('/notifications', { params: { limit } });
    return res.data;
  },

  markAsRead: async (id: string): Promise<void> => {
    await axiosInstance.patch(`/notifications/${id}/read`);
  },

  markAllAsRead: async (): Promise<void> => {
    await axiosInstance.patch('/notifications/read-all');
  },

  deleteNotification: async (id: string): Promise<void> => {
    await axiosInstance.delete(`/notifications/${id}`);
  },
};
