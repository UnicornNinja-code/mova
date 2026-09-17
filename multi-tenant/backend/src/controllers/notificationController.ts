/*
 * notificationController.ts
 * Controller for In-App User Notifications in TypeScript
 */

import type { Request, Response } from "express";
import { notificationRepository } from "../repositories/notificationRepository.js";

export const getMyNotifications = async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ msg: "Unauthorized" });
    }

    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 30;
    const notifications = await notificationRepository.getNotificationsByUserId(userId, limit);

    return res.status(200).json({
      status: "success",
      count: notifications.length,
      unread_count: notifications.filter((n) => !n.is_read).length,
      notifications,
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ msg: error.message || "Internal server error" });
  }
};

export const markNotificationAsRead = async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = req.user?.id;
    const id = req.params.id as string;

    if (!userId) {
      return res.status(401).json({ msg: "Unauthorized" });
    }

    const success = await notificationRepository.markAsRead(id, userId);
    if (!success) {
      return res.status(404).json({ msg: "Notifikasi tidak ditemukan." });
    }

    return res.status(200).json({ msg: "Notifikasi ditandai telah dibaca." });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ msg: error.message || "Internal server error" });
  }
};

export const markAllNotificationsAsRead = async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ msg: "Unauthorized" });
    }

    const count = await notificationRepository.markAllAsRead(userId);
    return res.status(200).json({ msg: `Semua (${count}) notifikasi ditandai telah dibaca.` });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ msg: error.message || "Internal server error" });
  }
};

export const deleteNotification = async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = req.user?.id;
    const id = req.params.id as string;

    if (!userId) {
      return res.status(401).json({ msg: "Unauthorized" });
    }

    const success = await notificationRepository.deleteNotification(id, userId);
    if (!success) {
      return res.status(404).json({ msg: "Notifikasi tidak ditemukan." });
    }

    return res.status(200).json({ msg: "Notifikasi berhasil dihapus." });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ msg: error.message || "Internal server error" });
  }
};
