/*
 * notificationRoutes.ts
 * Express Routes for In-App User Notifications in TypeScript
 */

import express from "express";
import {
  getMyNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
} from "../controllers/notificationController.js";
import { authenticateToken } from "../middlewares/authMiddleware.js";

const router = express.Router();

// All notification routes require authentication
router.use(authenticateToken);

router.get("/", getMyNotifications);
router.patch("/read-all", markAllNotificationsAsRead);
router.patch("/:id/read", markNotificationAsRead);
router.delete("/:id", deleteNotification);

export default router;
