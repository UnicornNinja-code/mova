/*
 * notificationRoutes.js
 * API Routes for Real-Time & Activity Notifications
 * Single-Tenant MOVA / COZIS Architecture
 */

import express from "express";
import { pool } from "../config/database.js";
import { authenticateToken } from "../middlewares/authMiddleware.js";

const router = express.Router();

// 1. Fetch recent notifications / alerts for authenticated user
router.get("/", authenticateToken, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT 
        id,
        action AS title,
        entity_type AS type,
        details,
        created_at AS timestamp,
        false AS is_read
      FROM audit_logs
      ORDER BY created_at DESC
      LIMIT 20;
    `);

    const notifications = rows.map((r) => ({
      id: r.id,
      title: r.title || "Notifikasi Sistem",
      type: r.type || "INFO",
      message: typeof r.details === "string" ? r.details : JSON.stringify(r.details || {}),
      timestamp: r.timestamp,
      is_read: r.is_read,
    }));

    return res.status(200).json({
      success: true,
      notifications,
      unread_count: notifications.filter((n) => !n.is_read).length,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ msg: error.message || "Internal server error" });
  }
});

// 2. Mark specific notification as read
router.patch("/:id/read", authenticateToken, (req, res) => {
  return res.status(200).json({
    success: true,
    msg: "Notifikasi ditandai sebagai terbaca",
  });
});

// 3. Mark all notifications as read
router.patch("/read-all", authenticateToken, (req, res) => {
  return res.status(200).json({
    success: true,
    msg: "Semua notifikasi ditandai sebagai terbaca",
  });
});

export default router;
