/*
 *   Copyright (c) 2026 
 *   All rights reserved.
 *   dashboardRoutes.js (API Routes for Dashboard Analytics & Reports)
 */

import express from "express";
import {
  getSummary,
  getSalesTrend,
  getZonePerformance,
  getProductPerformance,
  getQuickAlerts,
} from "../controllers/dashboardController.js";
import { authenticateToken } from "../middlewares/authMiddleware.js";
import { checkRole } from "../middlewares/roleMiddleware.js";

const router = express.Router();

// 1. Quick Alerts Center (SUPERADMIN, MANAGEMENT, SUPERVISOR)
router.get(
  "/quick-alerts",
  authenticateToken,
  checkRole(["SUPERADMIN", "MANAGEMENT", "SUPERVISOR"]),
  getQuickAlerts
);

// 2. Unified Dashboard Summary (SUPERADMIN, MANAGEMENT, SUPERVISOR)
router.get(
  "/summary",
  authenticateToken,
  checkRole(["SUPERADMIN", "MANAGEMENT", "SUPERVISOR"]),
  getSummary
);
router.get(
  "/overview",
  authenticateToken,
  checkRole(["SUPERADMIN", "MANAGEMENT", "SUPERVISOR"]),
  getSummary
);

// 3. Sales Trend Time-Series (SUPERADMIN, MANAGEMENT, SUPERVISOR)
router.get(
  "/sales-trend",
  authenticateToken,
  checkRole(["SUPERADMIN", "MANAGEMENT", "SUPERVISOR"]),
  getSalesTrend
);

// 4. Zone Performance & Capacity Metrics (SUPERADMIN, MANAGEMENT, SUPERVISOR)
router.get(
  "/zone-performance",
  authenticateToken,
  checkRole(["SUPERADMIN", "MANAGEMENT", "SUPERVISOR"]),
  getZonePerformance
);

// 5. Product Performance & Menu Contribution (SUPERADMIN, MANAGEMENT ONLY)
router.get(
  "/product-performance",
  authenticateToken,
  checkRole(["SUPERADMIN", "MANAGEMENT"]),
  getProductPerformance
);

export default router;
