/*
 * salesRoutes.ts
 * API Routes for Sales Overview & Reporting in TypeScript
 */

import express from "express";
import { getSalesOverview, getMySales } from "../controllers/salesController.js";
import { authenticateToken } from "../middlewares/authMiddleware.js";
import { checkRole } from "../middlewares/roleMiddleware.js";

const router = express.Router();

// 1. Get Aggregated Sales Analytics Overview (SUPERADMIN, MANAGEMENT, SUPERVISOR)
router.get(
  "/overview",
  authenticateToken,
  checkRole(["SUPERADMIN", "MANAGEMENT", "SUPERVISOR"]),
  getSalesOverview
);

// 2. Get Personal Sales History (Rider ownership-scoped)
router.get(
  "/my-sales",
  authenticateToken,
  getMySales
);

export default router;
