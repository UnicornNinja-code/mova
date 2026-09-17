/*
 * dashboardRoutes.ts
 * API Routes for Dashboard Analytics & Reports in TypeScript
 */

import express from "express";
import {
  getSummary,
  getSalesTrend,
  getZonePerformance,
  getProductPerformance,
} from "../controllers/dashboardController.js";
import { authenticateToken } from "../middlewares/authMiddleware.js";
import { checkRole } from "../middlewares/roleMiddleware.js";

const router = express.Router();

router.get(
  "/summary",
  authenticateToken,
  checkRole(["SUPERADMIN", "MANAGEMENT", "SUPERVISOR"]),
  getSummary
);

router.get(
  "/sales-trend",
  authenticateToken,
  checkRole(["SUPERADMIN", "MANAGEMENT", "SUPERVISOR"]),
  getSalesTrend
);

router.get(
  "/zone-performance",
  authenticateToken,
  checkRole(["SUPERADMIN", "MANAGEMENT", "SUPERVISOR"]),
  getZonePerformance
);

router.get(
  "/product-performance",
  authenticateToken,
  checkRole(["SUPERADMIN", "MANAGEMENT"]),
  getProductPerformance
);

export default router;
